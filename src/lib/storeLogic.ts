import { StoreItem, PracticeSession } from './types';
import { getAvailableCopper } from './storage';
import { formatPriceCompact } from './storeCurrency';

export interface AvailabilityCheck {
  available: boolean;
  reason?: string;
}

export interface RequirementExplanation {
  itemName: string;
  meetsAllRequirements: boolean;
  details: string[];
}

/**
 * Calculate total practice minutes in the last N days
 */
export const getMinutesInLastNDays = (
  sessions: PracticeSession[],
  windowDays: number
): number => {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);
  
  return sessions
    .filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= windowStart && sessionDate <= now;
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0);
};

/**
 * Get current streak for a student (from medalEngine)
 */
export const getCurrentStreak = (studentId: string): number => {
  const { getCurrentStreak: getStreak } = require('./medalEngine');
  return getStreak(studentId);
};

/**
 * Check if a store item is available for purchase by a student
 * Uses copper-based currency system (priceCredits = copper equivalent)
 */
export const isStoreItemAvailableForStudent = (
  studentId: string,
  item: StoreItem,
  sessions: PracticeSession[],
  _credits?: number // Legacy param, ignored - we use availableCopper
): AvailabilityCheck => {
  // Check if item is active
  if (!item.isActive) {
    return { available: false, reason: 'המוצר אינו זמין כרגע' };
  }

  // Check stock
  if (item.stock <= 0) {
    return { available: false, reason: 'המוצר אזל מהמלאי' };
  }

  // Check copper balance (priceCredits = copper equivalent)
  const availableCopper = getAvailableCopper(studentId);
  const priceCopper = item.priceCredits;
  
  if (availableCopper < priceCopper) {
    const missing = priceCopper - availableCopper;
    return { 
      available: false, 
      reason: `חסרות ${formatPriceCompact(missing)} מדליות` 
    };
  }

  // Check requirements if any
  if (item.requirements) {
    const { minStreakDays, minMinutesInLastNDays, windowDays = 7 } = item.requirements;

    // Check streak requirement
    if (minStreakDays && minStreakDays > 0) {
      const currentStreak = getCurrentStreak(studentId);
      if (currentStreak < minStreakDays) {
        return { 
          available: false, 
          reason: `נדרש רצף של ${minStreakDays} ימים (יש לך ${currentStreak})` 
        };
      }
    }

    // Check minutes in window requirement
    if (minMinutesInLastNDays && minMinutesInLastNDays > 0) {
      const minutesInWindow = getMinutesInLastNDays(sessions, windowDays);
      if (minutesInWindow < minMinutesInLastNDays) {
        return { 
          available: false, 
          reason: `נדרשות ${minMinutesInLastNDays} דקות אימון ב-${windowDays} הימים האחרונים (יש לך ${minutesInWindow})` 
        };
      }
    }
  }

  return { available: true };
};

/**
 * Build a detailed explanation of item requirements and student's status
 * Uses copper-based currency system
 */
export const buildRequirementExplanation = (
  studentId: string,
  item: StoreItem,
  sessions: PracticeSession[],
  _credits?: number // Legacy param, ignored
): RequirementExplanation => {
  const details: string[] = [];
  let meetsAllRequirements = true;

  // Get available copper
  const availableCopper = getAvailableCopper(studentId);
  const priceCopper = item.priceCredits;

  // Price check with medal display
  details.push(`💰 מחיר: ${formatPriceCompact(priceCopper)}`);
  if (availableCopper >= priceCopper) {
    details.push(`✅ יש לך ${formatPriceCompact(availableCopper)} - מספיק!`);
  } else {
    details.push(`❌ יש לך ${formatPriceCompact(availableCopper)} - חסרות ${formatPriceCompact(priceCopper - availableCopper)}`);
    meetsAllRequirements = false;
  }

  // Stock check
  if (item.stock <= 0) {
    details.push(`❌ המוצר אזל מהמלאי`);
    meetsAllRequirements = false;
  } else {
    details.push(`📦 מלאי: ${item.stock} יחידות`);
  }

  // Requirements
  if (item.requirements) {
    const { minStreakDays, minMinutesInLastNDays, windowDays = 7 } = item.requirements;

    if (minStreakDays && minStreakDays > 0) {
      const currentStreak = getCurrentStreak(studentId);
      details.push(`🔥 דרישת רצף: ${minStreakDays} ימים`);
      if (currentStreak >= minStreakDays) {
        details.push(`✅ הרצף שלך: ${currentStreak} ימים - עומדת בדרישה!`);
      } else {
        details.push(`❌ הרצף שלך: ${currentStreak} ימים - חסרים ${minStreakDays - currentStreak} ימים`);
        meetsAllRequirements = false;
      }
    }

    if (minMinutesInLastNDays && minMinutesInLastNDays > 0) {
      const minutesInWindow = getMinutesInLastNDays(sessions, windowDays);
      details.push(`⏱️ דרישה: ${minMinutesInLastNDays} דקות אימון ב-${windowDays} ימים אחרונים`);
      if (minutesInWindow >= minMinutesInLastNDays) {
        details.push(`✅ התאמנת ${minutesInWindow} דקות - עומדת בדרישה!`);
      } else {
        details.push(`❌ התאמנת ${minutesInWindow} דקות - חסרות ${minMinutesInLastNDays - minutesInWindow} דקות`);
        meetsAllRequirements = false;
      }
    }
  }

  // Active check
  if (!item.isActive) {
    details.push(`❌ המוצר אינו זמין כרגע`);
    meetsAllRequirements = false;
  }

  return {
    itemName: item.name,
    meetsAllRequirements,
    details
  };
};
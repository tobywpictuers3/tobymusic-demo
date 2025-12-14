import { StoreItem, PracticeSession, Student } from './types';
import { getStudentStatistics } from './storage';
import { recalcAllForStudent } from './practiceEngine';

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
 * Get current streak for a student
 */
export const getCurrentStreak = (studentId: string): number => {
  const cached = getStudentStatistics(studentId);
  // Use medalEngine for streak calculation (derived, not stored)
  const { getCurrentStreak } = await import('./medalEngine');
  return getCurrentStreak(studentId);

/**
 * Check if a store item is available for purchase by a student
 */
export const isStoreItemAvailableForStudent = (
  studentId: string,
  item: StoreItem,
  sessions: PracticeSession[],
  credits: number
): AvailabilityCheck => {
  // Check if item is active
  if (!item.isActive) {
    return { available: false, reason: 'המוצר אינו זמין כרגע' };
  }

  // Check stock
  if (item.stock <= 0) {
    return { available: false, reason: 'המוצר אזל מהמלאי' };
  }

  // Check credits
  if (credits < item.priceCredits) {
    return { 
      available: false, 
      reason: `חסרים ${item.priceCredits - credits} קרדיטים` 
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
 */
export const buildRequirementExplanation = (
  studentId: string,
  item: StoreItem,
  sessions: PracticeSession[],
  credits: number
): RequirementExplanation => {
  const details: string[] = [];
  let meetsAllRequirements = true;

  // Price check
  details.push(`💰 מחיר: ${item.priceCredits} קרדיטים`);
  if (credits >= item.priceCredits) {
    details.push(`✅ יש לך ${credits} קרדיטים - מספיק!`);
  } else {
    details.push(`❌ יש לך ${credits} קרדיטים - חסרים ${item.priceCredits - credits}`);
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

import { StoreItem, PracticeSession } from './types';
import { getAvailableCopper } from './storage';
import { formatPriceCompact } from './storeCurrency';
import { getCurrentStreak as getCurrentStreakFromEngine } from './medalEngine';

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
 * Get current streak for a student (delegates to medalEngine - single source of truth)
 */
export const getCurrentStreak = (studentId: string): number => {
  return getCurrentStreakFromEngine(studentId);
};

/**
 * Check if a store item is available for purchase by a student
 * Simplified: only checks copper balance and stock (no streak/minutes requirements)
 */
export const isStoreItemAvailableForStudent = (
  studentId: string,
  item: StoreItem,
  _sessions?: PracticeSession[], // Legacy param, no longer needed
  _credits?: number // Legacy param, ignored
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

  return { available: true };
};

/**
 * Build a detailed explanation of item requirements and student's status
 * Simplified: only price and stock (no streak/minutes requirements)
 */
export const buildRequirementExplanation = (
  studentId: string,
  item: StoreItem,
  _sessions?: PracticeSession[], // Legacy param, no longer needed
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
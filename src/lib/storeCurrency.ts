/**
 * STORE CURRENCY SYSTEM
 * =====================
 * 
 * Medals are the currency. Everything is converted to "copper equivalent".
 * 
 * CONVERSION RATES:
 * - 🟤 Bronze (נחושת) = 1 copper
 * - ⚪ Silver (כסף) = 7 copper
 * - 🟡 Gold (זהב) = 25 copper
 * - 🔵 Platinum (פלטינום) = 164 copper
 * 
 * availableCopper = earnedCopperTotal - usedCopperTotal
 */

import { getMedalSummary } from './medalEngine';

// ============= CONSTANTS =============

export const MEDAL_VALUES = {
  bronze: 1,
  silver: 7,
  gold: 25,
  platinum: 164,
} as const;

export const MEDAL_ICONS = {
  bronze: '🟤',
  silver: '⚪',
  gold: '🟡',
  platinum: '🔵',
} as const;

export const MEDAL_NAMES = {
  bronze: 'נחושת',
  silver: 'כסף',
  gold: 'זהב',
  platinum: 'פלטינום',
} as const;

// ============= TYPES =============

export interface MedalWallet {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface PriceBreakdown {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
}

// ============= CALCULATION FUNCTIONS =============

/**
 * Calculate total copper equivalent from medal counts
 */
export function calculateTotalCopper(wallet: MedalWallet): number {
  return (
    wallet.bronze * MEDAL_VALUES.bronze +
    wallet.silver * MEDAL_VALUES.silver +
    wallet.gold * MEDAL_VALUES.gold +
    wallet.platinum * MEDAL_VALUES.platinum
  );
}

/**
 * Calculate total earned copper for a student (from derived medals)
 */
export function calculateEarnedCopper(studentId: string): number {
  const summary = getMedalSummary(studentId);
  
  const wallet: MedalWallet = {
    bronze: summary.totalBronze,
    silver: summary.totalSilver,
    gold: summary.totalGold,
    platinum: summary.totalPlatinum,
  };
  
  return calculateTotalCopper(wallet);
}

/**
 * Get the medal wallet (counts) for a student
 */
export function getStudentMedalWallet(studentId: string): MedalWallet {
  const summary = getMedalSummary(studentId);
  
  return {
    bronze: summary.totalBronze,
    silver: summary.totalSilver,
    gold: summary.totalGold,
    platinum: summary.totalPlatinum,
  };
}

/**
 * Check if student can afford a price in copper
 */
export function canAfford(availableCopper: number, priceCopper: number): boolean {
  return availableCopper >= priceCopper;
}

/**
 * Break down a copper price into highest denomination medals (for display only)
 */
export function breakdownPrice(copperAmount: number): PriceBreakdown {
  let remaining = copperAmount;
  
  const platinum = Math.floor(remaining / MEDAL_VALUES.platinum);
  remaining -= platinum * MEDAL_VALUES.platinum;
  
  const gold = Math.floor(remaining / MEDAL_VALUES.gold);
  remaining -= gold * MEDAL_VALUES.gold;
  
  const silver = Math.floor(remaining / MEDAL_VALUES.silver);
  remaining -= silver * MEDAL_VALUES.silver;
  
  const bronze = remaining;
  
  return { platinum, gold, silver, bronze };
}

/**
 * Format a copper price for display (highest denomination + remainder)
 * Example: 32 copper → "1 🟡 זהב + 7 🟤 נחושת"
 */
export function formatPrice(copperAmount: number): string {
  const breakdown = breakdownPrice(copperAmount);
  const parts: string[] = [];
  
  if (breakdown.platinum > 0) {
    parts.push(`${breakdown.platinum} ${MEDAL_ICONS.platinum} ${MEDAL_NAMES.platinum}`);
  }
  if (breakdown.gold > 0) {
    parts.push(`${breakdown.gold} ${MEDAL_ICONS.gold} ${MEDAL_NAMES.gold}`);
  }
  if (breakdown.silver > 0) {
    parts.push(`${breakdown.silver} ${MEDAL_ICONS.silver} ${MEDAL_NAMES.silver}`);
  }
  if (breakdown.bronze > 0) {
    parts.push(`${breakdown.bronze} ${MEDAL_ICONS.bronze} ${MEDAL_NAMES.bronze}`);
  }
  
  if (parts.length === 0) {
    return `0 ${MEDAL_ICONS.bronze} ${MEDAL_NAMES.bronze}`;
  }
  
  return parts.join(' + ');
}

/**
 * Format a compact price for badges (just numbers and icons)
 * Example: 32 copper → "1🟡 + 7🟤"
 */
export function formatPriceCompact(copperAmount: number): string {
  const breakdown = breakdownPrice(copperAmount);
  const parts: string[] = [];
  
  if (breakdown.platinum > 0) {
    parts.push(`${breakdown.platinum}${MEDAL_ICONS.platinum}`);
  }
  if (breakdown.gold > 0) {
    parts.push(`${breakdown.gold}${MEDAL_ICONS.gold}`);
  }
  if (breakdown.silver > 0) {
    parts.push(`${breakdown.silver}${MEDAL_ICONS.silver}`);
  }
  if (breakdown.bronze > 0) {
    parts.push(`${breakdown.bronze}${MEDAL_ICONS.bronze}`);
  }
  
  if (parts.length === 0) {
    return `0${MEDAL_ICONS.bronze}`;
  }
  
  return parts.join(' + ');
}

/**
 * Format wallet for display (all medals with counts)
 */
export function formatWallet(wallet: MedalWallet): string {
  return [
    `${MEDAL_ICONS.platinum} ${wallet.platinum}`,
    `${MEDAL_ICONS.gold} ${wallet.gold}`,
    `${MEDAL_ICONS.silver} ${wallet.silver}`,
    `${MEDAL_ICONS.bronze} ${wallet.bronze}`,
  ].join('  ');
}

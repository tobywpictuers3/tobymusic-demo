/**
 * MEDAL ENGINE - SINGLE SOURCE OF TRUTH
 * =====================================
 * 
 * All medal calculations are DERIVED dynamically from practice history.
 * NO MEDALS ARE STORED OR PERSISTED - they are calculated at render time.
 * 
 * DAILY MEDAL THRESHOLDS:
 * - < 20 min → no medal
 * - 20-44 min → 🟤 Bronze
 * - 45-79 min → ⚪ Silver
 * - 80-179 min → 🟡 Gold
 * - ≥ 180 min → 🔵 Platinum
 * 
 * STREAK MEDAL THRESHOLDS (calendar-based YYYY-MM-DD):
 * - < 4 days → no medal
 * - 4-6 days → 🟤 Bronze
 * - 7-12 days → ⚪ Silver
 * - 13-20 days → 🟡 Gold
 * - ≥ 21 days → 🔵 Platinum
 */

import { getStudentPracticeSessions } from './storage';
import { PracticeSession } from './types';

// ============= TYPES =============

export type MedalLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface DailyMedal {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  level: MedalLevel | null;
  icon: string;
  name: string;
}

export interface StreakMedal {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  length: number;
  level: MedalLevel | null;
  icon: string;
  name: string;
  isActive: boolean;
}

export interface MedalSummary {
  dailyMedals: DailyMedal[];
  streakMedals: StreakMedal[];
  currentStreak: number;
  currentStreakMedal: StreakMedal | null;
  totalBronze: number;
  totalSilver: number;
  totalGold: number;
  totalPlatinum: number;
}

// ============= DAILY MEDAL LOGIC =============

/**
 * Get daily medal level based on total minutes (ONE medal per day, highest achieved)
 */
export function getDailyMedalLevel(totalMinutes: number): MedalLevel | null {
  if (totalMinutes >= 180) return 'platinum';
  if (totalMinutes >= 80) return 'gold';
  if (totalMinutes >= 45) return 'silver';
  if (totalMinutes >= 20) return 'bronze';
  return null;
}

/**
 * Get medal icon and name for daily medals
 */
export function getDailyMedalInfo(level: MedalLevel | null): { icon: string; name: string } {
  switch (level) {
    case 'platinum': return { icon: '🔵', name: 'פלטינום' };
    case 'gold': return { icon: '🟡', name: 'זהב' };
    case 'silver': return { icon: '⚪', name: 'כסף' };
    case 'bronze': return { icon: '🟤', name: 'נחושת' };
    default: return { icon: '', name: '' };
  }
}

/**
 * Get threshold info for next daily medal
 */
export function getNextDailyMedalInfo(totalMinutes: number): { nextMedal: string; remaining: number } | null {
  if (totalMinutes < 20) return { nextMedal: 'נחושת (20 דקות)', remaining: 20 - totalMinutes };
  if (totalMinutes < 45) return { nextMedal: 'כסף (45 דקות)', remaining: 45 - totalMinutes };
  if (totalMinutes < 80) return { nextMedal: 'זהב (80 דקות)', remaining: 80 - totalMinutes };
  if (totalMinutes < 180) return { nextMedal: 'פלטינום (180 דקות)', remaining: 180 - totalMinutes };
  return null; // All daily medals achieved
}

// ============= STREAK MEDAL LOGIC =============

/**
 * Get streak medal level based on consecutive days (ONE medal per streak)
 */
export function getStreakMedalLevel(streakDays: number): MedalLevel | null {
  if (streakDays >= 21) return 'platinum';
  if (streakDays >= 13) return 'gold';
  if (streakDays >= 7) return 'silver';
  if (streakDays >= 4) return 'bronze';
  return null;
}

/**
 * Get medal icon and name for streak medals
 */
export function getStreakMedalInfo(level: MedalLevel | null): { icon: string; name: string } {
  switch (level) {
    case 'platinum': return { icon: '👑', name: 'רצף פלטינום' };
    case 'gold': return { icon: '🟡', name: 'רצף זהב' };
    case 'silver': return { icon: '⚪', name: 'רצף כסף' };
    case 'bronze': return { icon: '🔥', name: 'רצף נחושת' };
    default: return { icon: '', name: '' };
  }
}

/**
 * Get threshold info for next streak medal
 */
export function getNextStreakMedalInfo(streakDays: number): { nextMedal: string; remaining: number } | null {
  if (streakDays < 4) return { nextMedal: 'רצף נחושת (4 ימים)', remaining: 4 - streakDays };
  if (streakDays < 7) return { nextMedal: 'רצף כסף (7 ימים)', remaining: 7 - streakDays };
  if (streakDays < 13) return { nextMedal: 'רצף זהב (13 ימים)', remaining: 13 - streakDays };
  if (streakDays < 21) return { nextMedal: 'רצף פלטינום (21 ימים)', remaining: 21 - streakDays };
  return null; // Max streak medal achieved
}

// ============= CALCULATION FUNCTIONS =============

/**
 * Group practice sessions by date and calculate totals
 */
function getDailyTotals(sessions: PracticeSession[]): Map<string, number> {
  const totals = new Map<string, number>();
  
  sessions.forEach(session => {
    const current = totals.get(session.date) || 0;
    totals.set(session.date, current + session.durationMinutes);
  });
  
  return totals;
}

/**
 * Calculate all daily medals for a student (derived, not stored)
 */
export function calculateDailyMedals(studentId: string): DailyMedal[] {
  const sessions = getStudentPracticeSessions(studentId);
  const dailyTotals = getDailyTotals(sessions);
  
  const medals: DailyMedal[] = [];
  
  dailyTotals.forEach((totalMinutes, date) => {
    const level = getDailyMedalLevel(totalMinutes);
    const info = getDailyMedalInfo(level);
    
    medals.push({
      date,
      totalMinutes,
      level,
      icon: info.icon,
      name: info.name,
    });
  });
  
  // Sort by date descending
  return medals.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Add days to a date string (YYYY-MM-DD)
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Get difference in calendar days between two dates
 */
function daysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate all streak medals for a student (historical + active)
 * Uses calendar-based calculation (YYYY-MM-DD), not timestamps
 */
export function calculateStreakMedals(studentId: string): StreakMedal[] {
  const sessions = getStudentPracticeSessions(studentId);
  const dailyTotals = getDailyTotals(sessions);
  
  if (dailyTotals.size === 0) return [];
  
  // Get sorted unique dates
  const dates = Array.from(dailyTotals.keys()).sort();
  
  const streaks: StreakMedal[] = [];
  
  let streakStart = dates[0];
  let streakEnd = dates[0];
  let streakLength = 1;
  
  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1];
    const currDate = dates[i];
    const diff = daysDifference(prevDate, currDate);
    
    if (diff === 1) {
      // Consecutive day - extend streak
      streakEnd = currDate;
      streakLength++;
    } else {
      // Streak broken - save current streak if it has a medal
      const level = getStreakMedalLevel(streakLength);
      if (level) {
        const info = getStreakMedalInfo(level);
        streaks.push({
          startDate: streakStart,
          endDate: streakEnd,
          length: streakLength,
          level,
          icon: info.icon,
          name: info.name,
          isActive: false,
        });
      }
      
      // Start new streak
      streakStart = currDate;
      streakEnd = currDate;
      streakLength = 1;
    }
  }
  
  // Handle the last streak
  const today = new Date().toISOString().split('T')[0];
  const yesterday = addDays(today, -1);
  
  // Check if current streak is still active (practiced today or yesterday)
  const isActive = streakEnd === today || streakEnd === yesterday;
  
  const level = getStreakMedalLevel(streakLength);
  if (level) {
    const info = getStreakMedalInfo(level);
    streaks.push({
      startDate: streakStart,
      endDate: streakEnd,
      length: streakLength,
      level,
      icon: info.icon,
      name: info.name,
      isActive,
    });
  }
  
  // Sort by end date descending
  return streaks.sort((a, b) => b.endDate.localeCompare(a.endDate));
}

/**
 * Get current active streak length (calendar-based)
 */
export function getCurrentStreak(studentId: string): number {
  const sessions = getStudentPracticeSessions(studentId);
  const dailyTotals = getDailyTotals(sessions);
  
  if (dailyTotals.size === 0) return 0;
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = addDays(today, -1);
  
  // Get sorted dates
  const dates = Array.from(dailyTotals.keys()).sort();
  const lastDate = dates[dates.length - 1];
  
  // If last practice wasn't today or yesterday, streak is 0
  if (lastDate !== today && lastDate !== yesterday) {
    return 0;
  }
  
  // Count consecutive days backwards from the last practice date
  let streak = 1;
  let checkDate = lastDate;
  
  for (let i = dates.length - 2; i >= 0; i--) {
    const prevDate = dates[i];
    const expectedPrev = addDays(checkDate, -1);
    
    if (prevDate === expectedPrev) {
      streak++;
      checkDate = prevDate;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Get complete medal summary for a student (fully derived)
 */
export function getMedalSummary(studentId: string): MedalSummary {
  const dailyMedals = calculateDailyMedals(studentId);
  const streakMedals = calculateStreakMedals(studentId);
  const currentStreak = getCurrentStreak(studentId);
  
  // Find current active streak medal
  const currentStreakMedal = streakMedals.find(s => s.isActive) || null;
  
  // Count totals across both daily and streak medals
  let totalBronze = 0;
  let totalSilver = 0;
  let totalGold = 0;
  let totalPlatinum = 0;
  
  dailyMedals.forEach(m => {
    if (m.level === 'bronze') totalBronze++;
    if (m.level === 'silver') totalSilver++;
    if (m.level === 'gold') totalGold++;
    if (m.level === 'platinum') totalPlatinum++;
  });
  
  streakMedals.forEach(m => {
    if (m.level === 'bronze') totalBronze++;
    if (m.level === 'silver') totalSilver++;
    if (m.level === 'gold') totalGold++;
    if (m.level === 'platinum') totalPlatinum++;
  });
  
  return {
    dailyMedals,
    streakMedals,
    currentStreak,
    currentStreakMedal,
    totalBronze,
    totalSilver,
    totalGold,
    totalPlatinum,
  };
}

/**
 * Check if a new milestone was just reached (for celebrations)
 * Returns celebration info if a new threshold was crossed
 */
export function checkForNewDailyMilestone(
  previousMinutes: number,
  newMinutes: number
): { message: string; medal: string } | null {
  const prevLevel = getDailyMedalLevel(previousMinutes);
  const newLevel = getDailyMedalLevel(newMinutes);
  
  if (prevLevel === newLevel) return null;
  
  switch (newLevel) {
    case 'bronze':
      return { message: 'מעולה! 20 דקות אימון! קבלי מדליית נחושת! 🟤', medal: '🟤' };
    case 'silver':
      return { message: 'נפלא! 45 דקות אימון! מגיעה לך מדליית כסף! ⚪', medal: '⚪' };
    case 'gold':
      return { message: 'יוצא מן הכלל! 80 דקות אימון! מגיעה לך מדליית זהב! 🟡', medal: '🟡' };
    case 'platinum':
      return { message: 'בלתי יאומן! 180 דקות אימון! מגיעה לך מדליית פלטינום! 🔵', medal: '🔵' };
    default:
      return null;
  }
}

/**
 * Check if a new streak milestone was just reached (for celebrations)
 */
export function checkForNewStreakMilestone(
  previousStreak: number,
  newStreak: number
): { message: string; medal: string } | null {
  const prevLevel = getStreakMedalLevel(previousStreak);
  const newLevel = getStreakMedalLevel(newStreak);
  
  if (prevLevel === newLevel) return null;
  
  switch (newLevel) {
    case 'bronze':
      return { message: 'יפה מאוד! 4 ימים ברצף! מגיעה לך מדליית רצף! 🔥', medal: '🔥' };
    case 'silver':
      return { message: 'מדהים! 7 ימים ברצף! מגיעה לך מדליית רצף כסף! ⚪', medal: '⚪' };
    case 'gold':
      return { message: 'יוצא מן הכלל! 13 ימים ברצף! מגיעה לך מדליית רצף זהב! 🟡', medal: '🟡' };
    case 'platinum':
      return { message: 'בלתי יאומן! 21 ימים ברצף! מגיעה לך מדליית רצף פלטינום! 👑', medal: '👑' };
    default:
      return null;
  }
}

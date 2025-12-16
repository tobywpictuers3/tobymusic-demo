/**
 * LEADERBOARD ENGINE
 * ==================
 * 
 * All leaderboard calculations are DERIVED in real-time from practice data.
 * NO achievements are stored - everything is calculated at render time.
 * 
 * CATEGORIES:
 * 1. Daily Record (Rolling 7×24h) - Best single day in last 168 hours
 * 2. Weekly Record (Academic Year) - Best week (Sat-Sat) in academic year
 * 3. Longest Streak (Academic Year) - Longest consecutive practice days
 * 4. Best Lesson Average (Academic Year) - Best interval average
 * 5. Medal Score (Academic Year) - Total medal copper value
 * 
 * IMPORTANT:
 * - Rolling 7 days = exactly 7×24 hours back from NOW (not calendar days)
 * - Academic year bounds come from system settings, NOT hardcoded
 * - All categories 2-5 are filtered by academic year bounds
 */

import { getStudents, getLessons, getStudentPracticeSessions, getAcademicYearSettings } from './storage';
import { Student, PracticeSession, Lesson, LeaderboardEntryV2, AcademicYearSettings } from './types';
import { calculateTotalCopper, MEDAL_VALUES } from './storeCurrency';

// ============= TYPES =============

export interface StudentLeaderboardData {
  studentId: string;
  studentName: string;
  // Category 1: Rolling 7×24h daily record
  dailyRecord: { date: string; minutes: number } | null;
  // Category 2: Weekly record (academic year)
  weeklyRecord: { weekStart: string; minutes: number } | null;
  // Category 3: Longest streak (academic year)
  longestStreak: { startDate: string; endDate: string; days: number } | null;
  // Category 4: Best lesson-to-lesson average (academic year)
  bestLessonAverage: { startDate: string; endDate: string; average: number } | null;
  // Category 5: Medal score (academic year)
  medalScore: number;
}

export interface CategoryLeaderboard {
  category: string;
  entries: {
    studentId: string;
    studentName: string;
    value: number;
    displayValue: string;
    detail?: string;
  }[];
}

// ============= HELPER FUNCTIONS =============

/**
 * Get academic year bounds from system settings
 * Falls back to Sep 1 - Aug 31 only if no settings exist
 */
export function getAcademicYearBounds(): { start: Date; end: Date } {
  const settings = getAcademicYearSettings();
  
  if (settings) {
    return {
      start: new Date(settings.startDate + 'T00:00:00'),
      end: new Date(settings.endDate + 'T23:59:59'),
    };
  }
  
  // Fallback only if no settings configured
  console.warn('⚠️ Academic year settings not configured - using default Sep 1 - Aug 31');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (month >= 8) { // Sep-Dec
    return {
      start: new Date(year, 8, 1, 0, 0, 0),
      end: new Date(year + 1, 7, 31, 23, 59, 59),
    };
  } else { // Jan-Aug
    return {
      start: new Date(year - 1, 8, 1, 0, 0, 0),
      end: new Date(year, 7, 31, 23, 59, 59),
    };
  }
}

/**
 * Get rolling 7×24 hours window (TRUE rolling, not calendar days)
 */
export function getRolling7DayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Exactly 168 hours back
  return { start, end: now };
}

/**
 * Get Israeli week start (Saturday 00:00)
 */
function getWeekStartSaturday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday, 6=Saturday
  // Go back to most recent Saturday
  const daysBack = (day + 1) % 7;
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date is within academic year bounds
 */
function isInAcademicYear(dateStr: string, bounds: { start: Date; end: Date }): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  return date >= bounds.start && date <= bounds.end;
}

/**
 * Check if a timestamp is within rolling 7×24h window
 */
function isInRolling7Days(dateStr: string, bounds: { start: Date; end: Date }): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  return date >= bounds.start && date <= bounds.end;
}

/**
 * Group sessions by calendar day
 */
function groupSessionsByDay(sessions: PracticeSession[]): Map<string, number> {
  const totals = new Map<string, number>();
  sessions.forEach(session => {
    const current = totals.get(session.date) || 0;
    totals.set(session.date, current + session.durationMinutes);
  });
  return totals;
}

// ============= CATEGORY 1: DAILY RECORD (ROLLING 7×24H) =============

/**
 * Calculate best single day within rolling 7×24 hours
 */
export function calculateDailyRecord(studentId: string): { date: string; minutes: number } | null {
  const bounds = getRolling7DayBounds();
  const sessions = getStudentPracticeSessions(studentId);
  
  // Filter sessions within rolling window
  const filteredSessions = sessions.filter(s => isInRolling7Days(s.date, bounds));
  
  if (filteredSessions.length === 0) return null;
  
  const dailyTotals = groupSessionsByDay(filteredSessions);
  
  let bestDay: { date: string; minutes: number } | null = null;
  
  dailyTotals.forEach((minutes, date) => {
    if (!bestDay || minutes > bestDay.minutes) {
      bestDay = { date, minutes };
    }
  });
  
  return bestDay;
}

// ============= CATEGORY 2: WEEKLY RECORD (ACADEMIC YEAR) =============

/**
 * Calculate best week (Sat-Sat) within academic year
 */
export function calculateWeeklyRecord(studentId: string): { weekStart: string; minutes: number } | null {
  const academicBounds = getAcademicYearBounds();
  const sessions = getStudentPracticeSessions(studentId);
  
  // Filter sessions within academic year
  const filteredSessions = sessions.filter(s => isInAcademicYear(s.date, academicBounds));
  
  if (filteredSessions.length === 0) return null;
  
  // Group by week (Saturday start)
  const weeklyTotals = new Map<string, number>();
  
  filteredSessions.forEach(session => {
    const sessionDate = new Date(session.date + 'T12:00:00');
    const weekStart = formatDate(getWeekStartSaturday(sessionDate));
    const current = weeklyTotals.get(weekStart) || 0;
    weeklyTotals.set(weekStart, current + session.durationMinutes);
  });
  
  let bestWeek: { weekStart: string; minutes: number } | null = null;
  
  weeklyTotals.forEach((minutes, weekStart) => {
    if (!bestWeek || minutes > bestWeek.minutes) {
      bestWeek = { weekStart, minutes };
    }
  });
  
  return bestWeek;
}

// ============= CATEGORY 3: LONGEST STREAK (ACADEMIC YEAR) =============

/**
 * Add days to a date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Calculate longest streak within academic year
 */
export function calculateLongestStreak(studentId: string): { startDate: string; endDate: string; days: number } | null {
  const academicBounds = getAcademicYearBounds();
  const sessions = getStudentPracticeSessions(studentId);
  
  // Filter sessions within academic year and get unique dates with ≥1 minute
  const filteredSessions = sessions.filter(s => isInAcademicYear(s.date, academicBounds));
  const dailyTotals = groupSessionsByDay(filteredSessions);
  
  // Get dates with actual practice (≥1 minute)
  const practiceDates = Array.from(dailyTotals.entries())
    .filter(([_, minutes]) => minutes >= 1)
    .map(([date]) => date)
    .sort();
  
  if (practiceDates.length === 0) return null;
  
  let longestStreak: { startDate: string; endDate: string; days: number } | null = null;
  
  let streakStart = practiceDates[0];
  let streakEnd = practiceDates[0];
  let streakLength = 1;
  
  for (let i = 1; i < practiceDates.length; i++) {
    const expectedDate = addDays(practiceDates[i - 1], 1);
    
    if (practiceDates[i] === expectedDate) {
      // Consecutive day - extend streak
      streakEnd = practiceDates[i];
      streakLength++;
    } else {
      // Streak broken - save if longest
      if (!longestStreak || streakLength > longestStreak.days) {
        longestStreak = { startDate: streakStart, endDate: streakEnd, days: streakLength };
      }
      // Start new streak
      streakStart = practiceDates[i];
      streakEnd = practiceDates[i];
      streakLength = 1;
    }
  }
  
  // Handle last streak
  if (!longestStreak || streakLength > longestStreak.days) {
    longestStreak = { startDate: streakStart, endDate: streakEnd, days: streakLength };
  }
  
  return longestStreak;
}

// ============= CATEGORY 4: BEST LESSON AVERAGE (ACADEMIC YEAR) =============

/**
 * Calculate best lesson-to-lesson average within academic year
 */
export function calculateBestLessonAverage(studentId: string): { startDate: string; endDate: string; average: number } | null {
  const academicBounds = getAcademicYearBounds();
  
  // Get completed lessons within academic year, sorted by date
  const lessons = getLessons()
    .filter(l => l.studentId === studentId && l.status === 'completed')
    .filter(l => isInAcademicYear(l.date, academicBounds))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (lessons.length < 2) return null;
  
  const sessions = getStudentPracticeSessions(studentId);
  
  let bestInterval: { startDate: string; endDate: string; average: number } | null = null;
  
  for (let i = 1; i < lessons.length; i++) {
    const prevLesson = lessons[i - 1];
    const currLesson = lessons[i];
    
    // Calculate days between lessons
    const startDate = new Date(prevLesson.date + 'T00:00:00');
    const endDate = new Date(currLesson.date + 'T00:00:00');
    const days = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Sum practice minutes between lessons (inclusive of end, exclusive of start)
    const relevantSessions = sessions.filter(s => 
      s.date > prevLesson.date && s.date <= currLesson.date
    );
    const totalMinutes = relevantSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    
    const average = totalMinutes / days;
    
    if (!bestInterval || average > bestInterval.average) {
      bestInterval = {
        startDate: prevLesson.date,
        endDate: currLesson.date,
        average,
      };
    }
  }
  
  return bestInterval;
}

// ============= CATEGORY 5: MEDAL SCORE (ACADEMIC YEAR) =============

/**
 * Calculate total medal score within academic year
 */
export function calculateMedalScore(studentId: string): number {
  const academicBounds = getAcademicYearBounds();
  const sessions = getStudentPracticeSessions(studentId);
  
  // Filter sessions within academic year
  const filteredSessions = sessions.filter(s => isInAcademicYear(s.date, academicBounds));
  
  if (filteredSessions.length === 0) return 0;
  
  const dailyTotals = groupSessionsByDay(filteredSessions);
  
  let totalScore = 0;
  
  // Calculate daily medals contribution
  dailyTotals.forEach((minutes) => {
    if (minutes >= 180) {
      totalScore += MEDAL_VALUES.platinum;
    } else if (minutes >= 80) {
      totalScore += MEDAL_VALUES.gold;
    } else if (minutes >= 45) {
      totalScore += MEDAL_VALUES.silver;
    } else if (minutes >= 20) {
      totalScore += MEDAL_VALUES.bronze;
    }
  });
  
  // Add streak medals contribution (from longest streak in academic year)
  const longestStreak = calculateLongestStreak(studentId);
  if (longestStreak) {
    if (longestStreak.days >= 21) {
      totalScore += MEDAL_VALUES.platinum;
    } else if (longestStreak.days >= 13) {
      totalScore += MEDAL_VALUES.gold;
    } else if (longestStreak.days >= 7) {
      totalScore += MEDAL_VALUES.silver;
    } else if (longestStreak.days >= 4) {
      totalScore += MEDAL_VALUES.bronze;
    }
  }
  
  return totalScore;
}

// ============= AGGREGATE FUNCTIONS =============

/**
 * Get complete leaderboard data for a single student
 */
export function getStudentLeaderboardData(studentId: string): StudentLeaderboardData {
  const student = getStudents().find(s => s.id === studentId);
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'לא ידוע';
  
  return {
    studentId,
    studentName,
    dailyRecord: calculateDailyRecord(studentId),
    weeklyRecord: calculateWeeklyRecord(studentId),
    longestStreak: calculateLongestStreak(studentId),
    bestLessonAverage: calculateBestLessonAverage(studentId),
    medalScore: calculateMedalScore(studentId),
  };
}

/**
 * Get all leaderboards (top 3 per category) for all students
 */
export function getAllLeaderboards(): {
  dailyRecord: CategoryLeaderboard;
  weeklyRecord: CategoryLeaderboard;
  longestStreak: CategoryLeaderboard;
  bestLessonAverage: CategoryLeaderboard;
  medalScore: CategoryLeaderboard;
} {
  const students = getStudents();
  const allData = students.map(s => getStudentLeaderboardData(s.id));
  
  // Category 1: Daily Record (Rolling 7×24h)
  const dailyRecordEntries = allData
    .filter(d => d.dailyRecord && d.dailyRecord.minutes > 0)
    .sort((a, b) => (b.dailyRecord?.minutes || 0) - (a.dailyRecord?.minutes || 0))
    .slice(0, 3)
    .map(d => ({
      studentId: d.studentId,
      studentName: d.studentName,
      value: d.dailyRecord!.minutes,
      displayValue: `${d.dailyRecord!.minutes} דקות`,
      detail: d.dailyRecord!.date,
    }));
  
  // Category 2: Weekly Record (Academic Year)
  const weeklyRecordEntries = allData
    .filter(d => d.weeklyRecord && d.weeklyRecord.minutes > 0)
    .sort((a, b) => (b.weeklyRecord?.minutes || 0) - (a.weeklyRecord?.minutes || 0))
    .slice(0, 3)
    .map(d => ({
      studentId: d.studentId,
      studentName: d.studentName,
      value: d.weeklyRecord!.minutes,
      displayValue: `${d.weeklyRecord!.minutes} דקות`,
      detail: `שבוע ${d.weeklyRecord!.weekStart}`,
    }));
  
  // Category 3: Longest Streak (Academic Year)
  const longestStreakEntries = allData
    .filter(d => d.longestStreak && d.longestStreak.days > 0)
    .sort((a, b) => (b.longestStreak?.days || 0) - (a.longestStreak?.days || 0))
    .slice(0, 3)
    .map(d => ({
      studentId: d.studentId,
      studentName: d.studentName,
      value: d.longestStreak!.days,
      displayValue: `${d.longestStreak!.days} ימים`,
      detail: `${d.longestStreak!.startDate} - ${d.longestStreak!.endDate}`,
    }));
  
  // Category 4: Best Lesson Average (Academic Year)
  const bestLessonAverageEntries = allData
    .filter(d => d.bestLessonAverage && d.bestLessonAverage.average > 0)
    .sort((a, b) => (b.bestLessonAverage?.average || 0) - (a.bestLessonAverage?.average || 0))
    .slice(0, 3)
    .map(d => ({
      studentId: d.studentId,
      studentName: d.studentName,
      value: d.bestLessonAverage!.average,
      displayValue: `${d.bestLessonAverage!.average.toFixed(1)} דק' ליום`,
      detail: `${d.bestLessonAverage!.startDate} - ${d.bestLessonAverage!.endDate}`,
    }));
  
  // Category 5: Medal Score (Academic Year)
  const medalScoreEntries = allData
    .filter(d => d.medalScore > 0)
    .sort((a, b) => b.medalScore - a.medalScore)
    .slice(0, 3)
    .map(d => ({
      studentId: d.studentId,
      studentName: d.studentName,
      value: d.medalScore,
      displayValue: `${d.medalScore} נקודות`,
    }));
  
  return {
    dailyRecord: { category: 'דקות אימון יומי – שיא (7 ימים)', entries: dailyRecordEntries },
    weeklyRecord: { category: 'דקות אימון שבועי – שיא', entries: weeklyRecordEntries },
    longestStreak: { category: 'רצף אימונים שנתי', entries: longestStreakEntries },
    bestLessonAverage: { category: 'ממוצע אימונים שבועי – שנתי', entries: bestLessonAverageEntries },
    medalScore: { category: 'ניקוד מדליות שנתי', entries: medalScoreEntries },
  };
}

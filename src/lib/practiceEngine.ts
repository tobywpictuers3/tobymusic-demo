/**
 * CENTRAL PRACTICE ENGINE
 * -----------------------
 * All calculations of:
 * - intervals between lessons
 * - minutes per interval
 * - averages per interval
 * - streaks
 * - max daily minutes
 * - monthly achievements
 * - yearly achievements
 * - retroactive recalculations
 *
 * All logic in the app MUST call these functions instead of
 * doing calculations inside components.
 */

import {
  getLessons,
  getPracticeSessions,
  getStudentPracticeSessions,
  updateMonthlyAchievement,
  saveStudentStatistics,
} from '@/lib/storage';
import { Lesson, PracticeSession } from '@/lib/types';

/* -----------------------------------------------------------
   HELPERS
----------------------------------------------------------- */

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function groupByDate(sessions: PracticeSession[]) {
  const grouped: Record<string, PracticeSession[]> = {};
  sessions.forEach((s) => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });
  return grouped;
}

/* -----------------------------------------------------------
   1. LESSON INTERVALS (core of averages)
----------------------------------------------------------- */

export function calculateLessonIntervals(studentId: string) {
  const lessons = getLessons()
    .filter((l) => l.studentId === studentId && l.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessions = getStudentPracticeSessions(studentId);

  const intervals: {
    lessonId: string;
    startDate: string;
    endDate: string;
    totalMinutes: number;
    days: number;
    average: number;
  }[] = [];

  for (let i = 1; i < lessons.length; i++) {
    const previous = lessons[i - 1];
    const current = lessons[i];

    const start = new Date(previous.date);
    const end = new Date(current.date);
    const days = daysBetween(start, end);

    const relevant = sessions.filter(
      (s) => s.date > previous.date && s.date <= current.date
    );

    const totalMinutes = relevant.reduce((sum, s) => sum + s.durationMinutes, 0);
    const average = totalMinutes / days;

    intervals.push({
      lessonId: current.id,
      startDate: previous.date,
      endDate: current.date,
      totalMinutes,
      days,
      average,
    });
  }

  return intervals;
}

/* -----------------------------------------------------------
   2. DAILY TOTALS (for streaks, daily medals, monthly stats)
----------------------------------------------------------- */

export function calculateDailyStats(studentId: string) {
  const sessions = getStudentPracticeSessions(studentId);
  const grouped = groupByDate(sessions);

  const totals = Object.entries(grouped).map(([date, list]) => ({
    date,
    totalMinutes: list.reduce((sum, s) => sum + s.durationMinutes, 0),
  }));

  return totals.sort((a, b) => a.date.localeCompare(b.date));
}

/* -----------------------------------------------------------
   3. STREAK CALCULATION
----------------------------------------------------------- */

export function calculateStreak(studentId: string) {
  const daily = calculateDailyStats(studentId);
  if (daily.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < daily.length; i++) {
    const prev = new Date(daily[i - 1].date);
    const curr = new Date(daily[i].date);

    const diff = daysBetween(prev, curr);

    if (diff === 1 || diff === 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/* -----------------------------------------------------------
   4. MAX DAILY MINUTES
----------------------------------------------------------- */

export function calculateMaxDailyMinutes(studentId: string) {
  const daily = calculateDailyStats(studentId);
  if (daily.length === 0) return 0;
  return Math.max(...daily.map((d) => d.totalMinutes));
}

/* -----------------------------------------------------------
   5. MONTHLY ACHIEVEMENTS
----------------------------------------------------------- */

export function calculateMonthlyAchievements(studentId: string) {
  const sessions = getStudentPracticeSessions(studentId);

  const monthly: Record<
    string,
    { total: number; maxDaily: number; maxStreak: number }
  > = {};

  const grouped = groupByDate(sessions);

  // Organize by month
  Object.entries(grouped).forEach(([date, daySessions]) => {
    const month = date.slice(0, 7);
    const totalDay = daySessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );

    if (!monthly[month])
      monthly[month] = { total: 0, maxDaily: 0, maxStreak: 0 };

    monthly[month].total += totalDay;
    monthly[month].maxDaily = Math.max(monthly[month].maxDaily, totalDay);
  });

  // Streaks per month (correct handling)
  Object.keys(monthly).forEach((month) => {
    const sameMonthDates = Object.keys(grouped)
      .filter((d) => d.startsWith(month))
      .sort();

    let maxStreak = 1;
    let current = 1;

    for (let i = 1; i < sameMonthDates.length; i++) {
      const prev = new Date(sameMonthDates[i - 1]);
      const curr = new Date(sameMonthDates[i]);
      const diff = daysBetween(prev, curr);
      if (diff === 1 || diff === 0) {
        current++;
        maxStreak = Math.max(maxStreak, current);
      } else {
        current = 1;
      }
    }

    monthly[month].maxStreak = maxStreak;

    // Save monthly result directly:
    updateMonthlyAchievement(studentId, {
      maxDailyMinutes: monthly[month].maxDaily,
      maxStreak: maxStreak,
    });
  });

  return monthly;
}

/* -----------------------------------------------------------
   6. YEARLY ACHIEVEMENTS
----------------------------------------------------------- */

export function calculateYearlyAchievements(studentId: string) {
  const intervals = calculateLessonIntervals(studentId);

  // Group by academic year
  const yearly: Record<
    string,
    { averages: number[] }
  > = {};

  intervals.forEach((intv) => {
    const year = academicYearOf(intv.endDate);
    if (!yearly[year]) yearly[year] = { averages: [] };
    yearly[year].averages.push(intv.average);
  });

  const results = Object.entries(yearly).map(([year, data]) => ({
    year,
    maxDailyAverage: data.averages.length
      ? Math.max(...data.averages)
      : 0,
  }));

  return results.sort((a, b) => b.year.localeCompare(a.year));
}

function academicYearOf(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0–11
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/* -----------------------------------------------------------
   7. FULL RECALC FOR A STUDENT (RETROACTIVE)
----------------------------------------------------------- */

export function recalcAllForStudent(studentId: string) {
  const intervals = calculateLessonIntervals(studentId);
  const streak = calculateStreak(studentId);
  const maxDaily = calculateMaxDailyMinutes(studentId);
  const monthly = calculateMonthlyAchievements(studentId);
  const yearly = calculateYearlyAchievements(studentId);

  // Save to storage and trigger sync
  saveStudentStatistics(studentId, {
    intervals,
    streak,
    maxDaily,
    monthly,
    yearly,
  });

  return {
    intervals,
    streak,
    maxDaily,
    monthly,
    yearly,
  };
}


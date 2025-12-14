/**
 * CENTRAL PRACTICE ENGINE
 * -----------------------
 * All calculations of:
 * - intervals between lessons
 * - minutes per interval
 * - averages per interval
 * - daily totals
 *
 * NOTE: Medal calculations are now DERIVED in medalEngine.ts
 * This file no longer stores or persists medal data.
 */

import {
  getLessons,
  getStudentPracticeSessions,
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
   2. DAILY TOTALS (for UI display)
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
   3. MAX DAILY MINUTES
----------------------------------------------------------- */

export function calculateMaxDailyMinutes(studentId: string) {
  const daily = calculateDailyStats(studentId);
  if (daily.length === 0) return 0;
  return Math.max(...daily.map((d) => d.totalMinutes));
}

/* -----------------------------------------------------------
   4. YEARLY ACHIEVEMENTS (based on lesson intervals)
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
   5. RECALC FOR STUDENT (saves statistics for caching)
   NOTE: No longer handles medals - those are derived in medalEngine.ts
----------------------------------------------------------- */

export function recalcAllForStudent(studentId: string) {
  const intervals = calculateLessonIntervals(studentId);
  const maxDaily = calculateMaxDailyMinutes(studentId);
  const yearly = calculateYearlyAchievements(studentId);

  // Calculate weekly average from the last interval
  const weeklyAverage = intervals.length > 0 
    ? intervals[intervals.length - 1].average 
    : 0;

  // Save to storage for caching (statistics only, not medals)
  saveStudentStatistics(studentId, {
    intervals,
    maxDaily,
    yearly,
    weeklyAverage,
  });

  return {
    intervals,
    maxDaily,
    yearly,
    weeklyAverage,
  };
}


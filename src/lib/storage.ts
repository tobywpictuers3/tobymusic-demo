import { Student, Lesson, Payment, SwapRequest, FileEntry, ScheduleItem, StoreItem, StorePurchase, YearlyLeaderboardEntry, Message, PracticeSession, MonthlyAchievement, LeaderboardEntry, MedalPurchase } from './types';
import { hybridSync } from './hybridSync';
import { logger } from './logger';
import { isDevMode, setDevMode } from './devMode';
import { calculateEarnedCopper, formatPriceCompact } from './storeCurrency';

// In-memory storage for production mode
const inMemoryStorage: Record<string, any[]> = {};

// Simple ID generator
const generateId = (): string => Math.random().toString(36).substr(2, 9);

// Dev mode data storage
const devData: Record<string, any[]> = {};

// Set initial data from worker
export const initializeStorage = (data: Record<string, any[]>) => {
  Object.keys(data).forEach(key => {
    inMemoryStorage[key] = data[key] || [];
  });

  logger.info('[Storage] Initialized with:', Object.keys(data).map(k => `${k}: ${data[k]?.length || 0}`).join(', '));
};

// Generic getter
const getData = <T>(key: string): T[] => {
  if (isDevMode()) return devData[key] || [];
  return inMemoryStorage[key] || [];
};

// Generic setter
const setData = <T>(key: string, data: T[], shouldSync: boolean = true): void => {
  if (isDevMode()) {
    devData[key] = data;
  } else {
    inMemoryStorage[key] = data;
    if (shouldSync) hybridSync.onDataChange();
  }
};

// ==================== EXPORT / IMPORT ALL (hybridSync depends on this) ====================

export const exportAllData = (): Record<string, any[]> => {
  const keys = Object.keys(inMemoryStorage);
  const out: Record<string, any[]> = {};
  keys.forEach(k => {
    out[k] = inMemoryStorage[k] || [];
  });
  return out;
};

export const setAllData = (data: Record<string, any[]>): void => {
  Object.keys(data).forEach(key => {
    inMemoryStorage[key] = data[key] || [];
  });
};

// ==================== DEV HELPERS ====================

export const setDevData = (data: Record<string, any[]>): void => {
  Object.keys(data).forEach(key => {
    devData[key] = data[key] || [];
  });
};

export const getDevData = (): Record<string, any[]> => {
  return devData;
};

export const clearAllData = async (): Promise<void> => {
  Object.keys(inMemoryStorage).forEach(key => {
    inMemoryStorage[key] = [];
  });
  if (!isDevMode()) {
    await hybridSync.onDestructiveChange();
  }
};

// ==================== STUDENTS ====================

export const getStudents = (): Student[] => getData<Student>('students');

export const getStudent = (id: string): Student | undefined => {
  return getStudents().find(s => s.id === id);
};

export const addStudent = (student: Omit<Student, 'id' | 'createdAt'>): Student => {
  const students = getStudents();
  const now = new Date().toISOString();
  const newStudent: Student = {
    ...student,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  students.push(newStudent);

  if (isDevMode()) {
    devData['students'] = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return newStudent;
};

export const updateStudent = (id: string, updatedFields: Partial<Student>): Student | undefined => {
  const students = getStudents();
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return undefined;

  students[index] = {
    ...students[index],
    ...updatedFields,
    lastModified: new Date().toISOString()
  };

  if (isDevMode()) {
    devData['students'] = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return students[index];
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  const students = getStudents();
  const updatedStudents = students.filter(s => s.id !== id);
  if (updatedStudents.length === students.length) return false;

  if (isDevMode()) {
    devData['students'] = updatedStudents;
  } else {
    inMemoryStorage['students'] = updatedStudents;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ==================== LESSONS ====================

export const getLessons = (): Lesson[] => getData<Lesson>('lessons');

export const getLesson = (id: string): Lesson | undefined => {
  return getLessons().find(l => l.id === id);
};

export const addLesson = (lesson: Omit<Lesson, 'id' | 'createdAt'>): Lesson => {
  const lessons = getLessons();
  const now = new Date().toISOString();
  const newLesson: Lesson = {
    ...lesson,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  lessons.push(newLesson);

  if (isDevMode()) {
    devData['lessons'] = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return newLesson;
};

export const updateLesson = (id: string, updatedFields: Partial<Lesson>): Lesson | undefined => {
  const lessons = getLessons();
  const index = lessons.findIndex(l => l.id === id);
  if (index === -1) return undefined;

  lessons[index] = {
    ...lessons[index],
    ...updatedFields,
    lastModified: new Date().toISOString()
  };

  if (isDevMode()) {
    devData['lessons'] = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return lessons[index];
};

export const deleteLesson = async (id: string): Promise<boolean> => {
  const lessons = getLessons();
  const updatedLessons = lessons.filter(l => l.id !== id);
  if (updatedLessons.length === lessons.length) return false;

  if (isDevMode()) {
    devData['lessons'] = updatedLessons;
  } else {
    inMemoryStorage['lessons'] = updatedLessons;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ==================== PAYMENTS ====================

export const getPayments = (): Payment[] => getData<Payment>('payments');

export const getStudentPayments = (studentId: string): Payment[] => {
  return getPayments().filter(p => p.studentId === studentId);
};

export const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
  const payments = getPayments();
  const now = new Date().toISOString();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  payments.push(newPayment);

  if (isDevMode()) {
    devData['payments'] = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return newPayment;
};

export const updatePayment = (id: string, updatedFields: Partial<Payment>): Payment | undefined => {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === id);
  if (index === -1) return undefined;

  payments[index] = {
    ...payments[index],
    ...updatedFields,
    lastModified: new Date().toISOString()
  };

  if (isDevMode()) {
    devData['payments'] = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return payments[index];
};

export const deletePayment = async (id: string): Promise<boolean> => {
  const payments = getPayments();
  const updatedPayments = payments.filter(p => p.id !== id);
  if (updatedPayments.length === payments.length) return false;

  if (isDevMode()) {
    devData['payments'] = updatedPayments;
  } else {
    inMemoryStorage['payments'] = updatedPayments;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ==================== SWAP REQUESTS ====================

export const getSwapRequests = (): SwapRequest[] => getData<SwapRequest>('swapRequests');

export const getStudentSwapRequests = (studentId: string): SwapRequest[] => {
  return getSwapRequests().filter(r => r.studentId === studentId);
};

export const addSwapRequest = (request: Omit<SwapRequest, 'id' | 'createdAt'>): SwapRequest => {
  const requests = getSwapRequests();
  const now = new Date().toISOString();
  const newRequest: SwapRequest = {
    ...request,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  requests.push(newRequest);

  if (isDevMode()) {
    devData['swapRequests'] = requests;
  } else {
    inMemoryStorage['swapRequests'] = requests;
    hybridSync.onDataChange();
  }
  return newRequest;
};

export const updateSwapRequest = (id: string, updatedFields: Partial<SwapRequest>): SwapRequest | undefined => {
  const requests = getSwapRequests();
  const index = requests.findIndex(r => r.id === id);
  if (index === -1) return undefined;

  requests[index] = {
    ...requests[index],
    ...updatedFields,
    lastModified: new Date().toISOString()
  };

  if (isDevMode()) {
    devData['swapRequests'] = requests;
  } else {
    inMemoryStorage['swapRequests'] = requests;
    hybridSync.onDataChange();
  }
  return requests[index];
};

export const deleteSwapRequest = async (id: string): Promise<boolean> => {
  const requests = getSwapRequests();
  const updatedRequests = requests.filter(r => r.id !== id);
  if (updatedRequests.length === requests.length) return false;

  if (isDevMode()) {
    devData['swapRequests'] = updatedRequests;
  } else {
    inMemoryStorage['swapRequests'] = updatedRequests;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ==================== FILES ====================

export const getFiles = (): FileEntry[] => getData<FileEntry>('files');

export const addFile = (file: Omit<FileEntry, 'id' | 'uploadedAt'>): FileEntry => {
  const files = getFiles();
  const now = new Date().toISOString();
  const newFile: FileEntry = {
    ...file,
    id: generateId(),
    uploadedAt: now,
    lastModified: now,
  };
  files.push(newFile);

  if (isDevMode()) {
    devData['files'] = files;
  } else {
    inMemoryStorage['files'] = files;
    hybridSync.onDataChange();
  }
  return newFile;
};

export const deleteFile = async (id: string): Promise<boolean> => {
  const files = getFiles();
  const updatedFiles = files.filter(f => f.id !== id);
  if (updatedFiles.length === files.length) return false;

  if (isDevMode()) {
    devData['files'] = updatedFiles;
  } else {
    inMemoryStorage['files'] = updatedFiles;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ==================== MESSAGES ====================

export const getMessages = (): Message[] => getData<Message>('messages');

export const addMessage = (message: Omit<Message, 'id' | 'sentAt'>): Message => {
  const messages = getMessages();
  const now = new Date().toISOString();
  const newMessage: Message = {
    ...message,
    id: generateId(),
    sentAt: now,
    lastModified: now,
  };
  messages.push(newMessage);

  if (isDevMode()) {
    devData['messages'] = messages;
  } else {
    inMemoryStorage['messages'] = messages;
    hybridSync.onDataChange();
  }
  return newMessage;
};

// ==================== PRACTICE SESSIONS ====================

export const getPracticeSessions = (): PracticeSession[] => {
  if (isDevMode()) return devData['practiceSessions'] || [];
  return inMemoryStorage['practiceSessions'] || [];
};

export const getStudentPracticeSessions = (studentId: string): PracticeSession[] => {
  const sessions = getPracticeSessions();
  return sessions.filter(s => s.studentId === studentId);
};

// ===================== DERIVED MONTHLY ACHIEVEMENTS (RECALCULATED) =====================

/**
 * Recalculate a student's monthly achievements from practice sessions (source of truth).
 * This fixes the "max only" bug where a mistaken high value could never go down after edits/deletes.
 */
const recalcMonthlyAchievementFromSessions = (
  studentId: string,
  month: string, // YYYY-MM
  shouldSync: boolean = false
): void => {
  const sessions = getPracticeSessions().filter(
    (s) => s.studentId === studentId && s.date.startsWith(month)
  );

  const dailyTotals: Record<string, number> = {};
  for (const s of sessions) {
    dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
  }

  const maxDailyMinutes =
    Object.keys(dailyTotals).length > 0 ? Math.max(...Object.values(dailyTotals)) : 0;

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const practicedDays = Object.keys(dailyTotals).length;
  const dailyAverage = practicedDays > 0 ? totalMinutes / practicedDays : 0;

  const practicedDates = Object.keys(dailyTotals)
    .filter((d) => dailyTotals[d] >= 1)
    .sort();

  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const d of practicedDates) {
    const cur = new Date(d);
    if (!prevDate) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    prevDate = cur;
  }

  const achievements: MonthlyAchievement[] = isDevMode()
    ? (devData['monthlyAchievements'] || [])
    : (inMemoryStorage['monthlyAchievements'] || []);

  const index = achievements.findIndex((a) => a.studentId === studentId && a.month === month);
  const now = new Date().toISOString();

  const next: MonthlyAchievement = {
    id: index !== -1 ? achievements[index].id : generateId(),
    studentId,
    month,
    maxDailyAverage: dailyAverage,
    maxDailyMinutes: maxDailyMinutes,
    maxStreak: maxStreak,
    createdAt: index !== -1 ? achievements[index].createdAt : now,
    updatedAt: now,
    lastModified: now,
  };

  if (index !== -1) {
    achievements[index] = next;
  } else {
    achievements.push(next);
  }

  if (isDevMode()) {
    devData['monthlyAchievements'] = achievements;
  } else {
    inMemoryStorage['monthlyAchievements'] = achievements;
    if (shouldSync) {
      hybridSync.onDataChange();
    }
  }
};

export const addPracticeSession = (session: Omit<PracticeSession, 'id' | 'createdAt'>): PracticeSession => {
  const sessions = getPracticeSessions();
  const now = new Date().toISOString();
  const newSession: PracticeSession = {
    ...session,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  sessions.push(newSession);

  // derived monthly achievements (can go up or down)
  recalcMonthlyAchievementFromSessions(newSession.studentId, newSession.date.slice(0, 7), false);

  if (isDevMode()) {
    devData['practiceSessions'] = sessions;
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    hybridSync.onDataChange();
  }
  return newSession;
};

export const updatePracticeSession = (id: string, updatedFields: Partial<PracticeSession>): PracticeSession | undefined => {
  const sessions = getPracticeSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return undefined;

  const before = sessions[index];
  const beforeMonth = before.date.slice(0, 7);

  sessions[index] = {
    ...sessions[index],
    ...updatedFields,
    lastModified: new Date().toISOString()
  };

  const after = sessions[index];
  const afterMonth = after.date.slice(0, 7);

  // recalc affected month(s)
  recalcMonthlyAchievementFromSessions(after.studentId, afterMonth, false);
  if (beforeMonth !== afterMonth) {
    recalcMonthlyAchievementFromSessions(before.studentId, beforeMonth, false);
  }

  if (isDevMode()) {
    devData['practiceSessions'] = sessions;
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    hybridSync.onDataChange();
  }
  return sessions[index];
};

export const deletePracticeSession = async (id: string): Promise<boolean> => {
  const sessions = getPracticeSessions();
  const sessionToDelete = sessions.find(s => s.id === id);
  const updatedSessions = sessions.filter(s => s.id !== id);
  if (updatedSessions.length === sessions.length) return false;

  if (isDevMode()) {
    devData['practiceSessions'] = updatedSessions;
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }
  } else {
    inMemoryStorage['practiceSessions'] = updatedSessions;
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }
    await hybridSync.onDestructiveChange();
  }

  return true;
};

// ==================== MONTHLY ACHIEVEMENTS ====================

export const getMonthlyAchievements = (): MonthlyAchievement[] => {
  if (isDevMode()) return devData['monthlyAchievements'] || [];
  return inMemoryStorage['monthlyAchievements'] || [];
};

export const getStudentMonthlyAchievements = (studentId: string): MonthlyAchievement[] => {
  const achievements = getMonthlyAchievements();
  return achievements.filter(a => a.studentId === studentId);
};

export const getCurrentMonthAchievement = (studentId: string): MonthlyAchievement | null => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const achievements = getMonthlyAchievements();
  return achievements.find(a => a.studentId === studentId && a.month === currentMonth) || null;
};

export const updateMonthlyAchievement = (
  studentId: string,
  _updates: { maxDailyAverage?: number; maxDailyMinutes?: number; maxStreak?: number }
): void => {
  // Monthly achievements are derived from practice sessions (source of truth).
  // Recalculate so values can also go DOWN after edits/deletes.
  const currentMonth = new Date().toISOString().slice(0, 7);
  recalcMonthlyAchievementFromSessions(studentId, currentMonth, true);
};

export const getCurrentMonthLeaderboard = (): LeaderboardEntry[] => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const achievements = getMonthlyAchievements().filter(a => a.month === currentMonth);
  const students = getStudents();

  return achievements
    .map(a => {
      const student = students.find(s => s.id === a.studentId);
      if (!student) return null;

      return {
        studentId: a.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        value: a.maxDailyAverage,
        type: 'avgDailyMinutes',
      } as LeaderboardEntry;
    })
    .filter(Boolean) as LeaderboardEntry[];
};

// ==================== MEDAL PURCHASES ====================

export const getMedalPurchases = (): MedalPurchase[] => getData<MedalPurchase>('medalPurchases');

export const addMedalPurchase = (purchase: Omit<MedalPurchase, 'id' | 'createdAt'>): MedalPurchase => {
  const purchases = getMedalPurchases();
  const now = new Date().toISOString();
  const newPurchase: MedalPurchase = {
    ...purchase,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  purchases.push(newPurchase);

  if (isDevMode()) {
    devData['medalPurchases'] = purchases;
  } else {
    inMemoryStorage['medalPurchases'] = purchases;
    hybridSync.onDataChange();
  }
  return newPurchase;
};

// ==================== YEARLY LEADERBOARD ====================

export const getYearlyLeaderboard = (): YearlyLeaderboardEntry[] => {
  const students = getStudents();
  const allSessions = getPracticeSessions();

  const sessionsByStudent = new Map<string, PracticeSession[]>();
  for (const s of allSessions) {
    if (!sessionsByStudent.has(s.studentId)) sessionsByStudent.set(s.studentId, []);
    sessionsByStudent.get(s.studentId)!.push(s);
  }

  const entries: YearlyLeaderboardEntry[] = students.map(student => {
    const sessions = sessionsByStudent.get(student.id) || [];

    const dailyTotals: Record<string, number> = {};
    for (const s of sessions) {
      dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
    }

    const dailyTotalsValues = Object.values(dailyTotals);
    const maxDaily = dailyTotalsValues.length ? Math.max(...dailyTotalsValues) : 0;

    const practicedDates = Object.keys(dailyTotals)
      .filter(d => dailyTotals[d] >= 1)
      .sort();

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const d of practicedDates) {
      const cur = new Date(d);
      if (!prevDate) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
      prevDate = cur;
    }

    const weekTotals: Record<string, number> = {};
    const getWeekKey = (dateStr: string): string => {
      const d = new Date(dateStr);
      const dayNum = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
      d.setDate(d.getDate() - dayNum + 3); // Thursday
      const firstThursday = new Date(d.getFullYear(), 0, 4);
      const firstDayNum = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
      const weekNo = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
      const year = d.getFullYear();
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    };

    for (const s of sessions) {
      const wk = getWeekKey(s.date);
      weekTotals[wk] = (weekTotals[wk] || 0) + (s.durationMinutes || 0);
    }

    const maxWeekly = Object.values(weekTotals).length ? Math.max(...Object.values(weekTotals)) : 0;

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const practicedWeeks = Object.keys(weekTotals).length;
    const weeklyAverage = practicedWeeks > 0 ? totalMinutes / practicedWeeks : 0;

    let medalCopper = 0;
    for (const minutes of Object.values(dailyTotals)) {
      medalCopper += calculateEarnedCopper(minutes);
    }

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      maxDailyMinutes: maxDaily,
      maxWeeklyMinutes: maxWeekly,
      longestStreak: maxStreak,
      weeklyAverageMinutes: weeklyAverage,
      medalScoreCopper: medalCopper,
      medalScoreFormatted: formatPriceCompact(medalCopper),
    };
  });

  return entries;
};

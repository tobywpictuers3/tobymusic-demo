import { Student, Lesson, Payment, SwapRequest, FileEntry, ScheduleTemplate, IntegrationSettings, Performance, OneTimePayment, Holiday, PracticeSession, MonthlyAchievement, LeaderboardEntry, MedalRecord } from './types';
import { hybridSync } from './hybridSync';
import { logger } from './logger';
import { isDevMode, setDevMode } from './devMode';

// In-Memory Storage - No localStorage for sensitive data
const inMemoryStorage: Record<string, any> = {};

// Expose storage via window for lessonSwap module access
if (typeof window !== 'undefined') {
  (window as any).__musicSystemStorage = inMemoryStorage;
}

// Dev Mode: Completely isolated in-memory storage (no Worker, no sync)
const devData: Record<string, any> = {
  students: [],
  lessons: [],
  calendar: [],
  payments: [],
  scheduleTemplates: [],
  swapRequests: [], // New field for swap requests
  files: [],
  integrationSettings: {},
  performances: [],
  oneTimePayments: [],
  holidays: [],
  practiceSessions: [],
  monthlyAchievements: [],
  leaderboard: [],
  medals: [],
  messages: [],
  studentStats: {},
  tithePaid: {}
};

export { isDevMode, setDevMode };

export const getDevStore = () => devData;

// Initialize data from Worker
export const initializeStorage = (data: any) => {
  if (!data || typeof data !== 'object') {
    logger.error('❌ Invalid data provided to initializeStorage');
    return;
  }
  
  let initialized = false;
  let keysFound = 0;
  
  Object.keys(data).forEach(key => {
    if (key.startsWith('musicSystem_') || key === 'oneTimePayments') {
      const storageKey = key.replace('musicSystem_', '');
      inMemoryStorage[storageKey] = data[key];
      initialized = true;
      keysFound++;
    }
  });
  
  // Ensure swapRequests exists as empty array if not provided
  if (!inMemoryStorage['swapRequests']) {
    inMemoryStorage['swapRequests'] = [];
  }
  
  if (initialized) {
    logger.info(`✅ Memory storage initialized with ${keysFound} data keys`);
  } else {
    logger.warn('⚠️ No valid data keys found during initialization');
  }
  
  // Keep only session token in sessionStorage (not localStorage)
  const currentUser = localStorage.getItem('musicSystem_currentUser');
  if (currentUser) {
    sessionStorage.setItem('musicSystem_currentUser', currentUser);
  }
};

// Export all data for Worker sync
export const exportAllData = (allowEmpty: boolean = false): Record<string, any> => {
  const data: Record<string, any> = {};
  
  Object.keys(inMemoryStorage).forEach(key => {
    const fullKey = key === 'oneTimePayments' ? key : `musicSystem_${key}`;
    data[fullKey] = inMemoryStorage[key];
  });
  
  data.timestamp = new Date().toISOString();
  
  // 🛡️ GUARD: Check that we have at least student data (unless explicitly allowed to be empty)
  if (!allowEmpty) {
    const hasStudents = data.musicSystem_students && 
                       Array.isArray(data.musicSystem_students) && 
                       data.musicSystem_students.length > 0;
    
    if (!hasStudents) {
      logger.error('❌ PREVENTED EMPTY DATA SYNC - No students found!');
      throw new Error('Cannot export empty data - system integrity check failed');
    }
  }
  
  return data;
};

// Utility function to simulate server-side ID generation
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Students
export const getStudents = (): Student[] => {
  if (isDevMode()) return devData['students'] || [];
  return inMemoryStorage['students'] || [];
};

export const addStudent = (student: Omit<Student, 'id'>): Student => {
  const students = getStudents();
  const newStudent: Student = {
    ...student,
    id: generateId(),
    lastModified: new Date().toISOString(),
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
  const studentIndex = students.findIndex(student => student.id === id);

  if (studentIndex === -1) {
    return undefined; // Student not found
  }

  // Update the student with the provided fields
  students[studentIndex] = { 
    ...students[studentIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['students'] = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return students[studentIndex];
};

export const deleteStudent = (id: string): boolean => {
  const students = getStudents();
  const updatedStudents = students.filter(student => student.id !== id);
  if (updatedStudents.length === students.length) {
    return false; // No student was deleted
  }
  if (isDevMode()) {
    devData['students'] = updatedStudents;
  } else {
    inMemoryStorage['students'] = updatedStudents;
    hybridSync.onDataChange();
  }
  return true;
};

// Update student bank time with notes (feature removed)
export const updateStudentBankTime = (studentId: string, changeInMinutes: number): boolean => {
  // Bank time feature has been removed
  return false;
};

// Lessons
export const getLessons = (): Lesson[] => {
  if (isDevMode()) return devData['lessons'] || [];
  return inMemoryStorage['lessons'] || [];
};

export const addLesson = (lesson: Omit<Lesson, 'id'>): Lesson => {
  const lessons = getLessons();
  const newLesson: Lesson = {
    ...lesson,
    id: generateId(),
    lastModified: new Date().toISOString(),
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
  const lessonIndex = lessons.findIndex(lesson => lesson.id === id);

  if (lessonIndex === -1) {
    return undefined; // Lesson not found
  }

  lessons[lessonIndex] = { 
    ...lessons[lessonIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['lessons'] = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return lessons[lessonIndex];
};

export const deleteLesson = (id: string): boolean => {
  const lessons = getLessons();
  const updatedLessons = lessons.filter(lesson => lesson.id !== id);
  if (updatedLessons.length === lessons.length) {
    return false; // No lesson was deleted
  }
  if (isDevMode()) {
    devData['lessons'] = updatedLessons;
  } else {
    inMemoryStorage['lessons'] = updatedLessons;
    hybridSync.onDataChange();
  }
  return true;
};

// Helper for cascade changes
const persistCascadeChanges = (mutator: (store: typeof inMemoryStorage | typeof devData) => void) => {
  if (isDevMode()) {
    mutator(devData as any);
  } else {
    mutator(inMemoryStorage as any);
    hybridSync.onDataChange();
  }
};

// Cascade delete lesson - removes lesson and related swap requests
export const deleteLessonCascade = (lessonId: string): boolean => {
  const lessons = getLessons();
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return false;

  const { studentId, date, startTime } = lesson;

  persistCascadeChanges(store => {
    // 1. Delete the lesson itself
    store['lessons'] = (store['lessons'] || []).filter((l: any) => l.id !== lessonId);

    // 2. Delete related swap requests
    store['swapRequests'] = (store['swapRequests'] || []).filter((r: any) => {
      const byLessonId = r.requesterLessonId === lessonId || r.targetLessonId === lessonId;
      const byLegacyFields =
        (r.requesterId === studentId && r.date === date && r.time === startTime) ||
        (r.targetId === studentId && r.targetDate === date && r.targetTime === startTime);
      return !(byLessonId || byLegacyFields);
    });
  });

  return true;
};

// Cascade delete student - removes student and all related data
export const deleteStudentCascade = (studentId: string): boolean => {
  const exists = getStudents().some(s => s.id === studentId);
  if (!exists) return false;

  persistCascadeChanges(store => {
    store['students'] = (store['students'] || []).filter((s: any) => s.id !== studentId);
    store['lessons'] = (store['lessons'] || []).filter((l: any) => l.studentId !== studentId);
    store['payments'] = (store['payments'] || []).filter((p: any) => p.studentId !== studentId);
    store['files'] = (store['files'] || []).filter((f: any) => f.studentId !== studentId);
    store['practiceSessions'] = (store['practiceSessions'] || []).filter((s: any) => s.studentId !== studentId);
    store['monthlyAchievements'] = (store['monthlyAchievements'] || []).filter((a: any) => a.studentId !== studentId);
    store['medalRecords'] = (store['medalRecords'] || []).filter((m: any) => m.studentId !== studentId);

    // Clean swap requests
    store['swapRequests'] = (store['swapRequests'] || []).filter((r: any) => {
      const oldShape = r.requesterId !== studentId && r.targetId !== studentId;
      const newShape = r.requesterStudentId !== studentId && r.targetStudentId !== studentId;
      return oldShape && newShape;
    });

    // Delete student statistics
    const stats = store['studentStats'] || {};
    if (stats[studentId]) {
      const updated = { ...stats };
      delete updated[studentId];
      store['studentStats'] = updated;
    }
  });

  return true;
};

// Payments
export const getPayments = (): Payment[] => {
  if (isDevMode()) return devData['payments'] || [];
  return inMemoryStorage['payments'] || [];
};

export const savePayments = (payments: Payment[]): void => {
  if (isDevMode()) {
    devData['payments'] = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
};

export const addPayment = (payment: Omit<Payment, 'id'>): Payment => {
  const payments = getPayments();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
    lastModified: new Date().toISOString(),
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

export const updatePayment = (studentId: string, month: string, updatedFields: Partial<Payment>): Payment | undefined => {
  const payments = getPayments();
  const paymentIndex = payments.findIndex(payment => payment.studentId === studentId && payment.month === month);

  if (paymentIndex === -1) {
    return undefined;
  }

  payments[paymentIndex] = { 
    ...payments[paymentIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['payments'] = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return payments[paymentIndex];
};

export const deletePayment = (id: string): boolean => {
  const payments = getPayments();
  const updatedPayments = payments.filter(payment => payment.id !== id);
  if (updatedPayments.length === payments.length) {
    return false; // No payment was deleted
  }
  inMemoryStorage['payments'] = updatedPayments;
  hybridSync.onDataChange();
  return true;
};

// Swap Requests
export const getSwapRequests = (): SwapRequest[] => {
  if (isDevMode()) return devData['swapRequests'] || [];
  return inMemoryStorage['swapRequests'] || [];
};

export const addSwapRequest = (swapRequest: Omit<SwapRequest, 'id'>) => {
  const requests = getSwapRequests();
  const newRequest = {
    ...swapRequest,
    id: Date.now().toString(),
    lastModified: new Date().toISOString(),
  };
  requests.push(newRequest);
  inMemoryStorage['swapRequests'] = requests;
  hybridSync.onDataChange();
  return newRequest;
};

export const updateSwapRequest = (requestId: string, updates: Partial<SwapRequest>) => {
  const requests = getSwapRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);
  
  if (requestIndex === -1) return;
  
  const request = requests[requestIndex];
  requests[requestIndex] = { 
    ...request, 
    ...updates,
    lastModified: new Date().toISOString()
  };
  
  // If approved, perform the actual swap
  if (updates.status === 'approved') {
    performLessonSwap(requests[requestIndex]);
  }
  
  inMemoryStorage['swapRequests'] = requests;
  hybridSync.onDataChange();
};

export const updateSwapRequestStatus = (requestId: string, status: 'approved' | 'rejected') => {
  updateSwapRequest(requestId, { status });
};

export const performLessonSwap = (swapRequest: SwapRequest) => {
  const lessons = getLessons();
  
  // Find EXISTING lessons only (not templates)
  const originalLessonIndex = lessons.findIndex(l => 
    l.studentId === swapRequest.requesterId && 
    l.date === swapRequest.date && 
    l.startTime === swapRequest.time
  );
  
  const targetLessonIndex = swapRequest.targetDate && swapRequest.targetTime
    ? lessons.findIndex(l => 
        l.studentId === swapRequest.targetId && 
        l.date === swapRequest.targetDate && 
        l.startTime === swapRequest.targetTime
      )
    : -1;
  
  // Only swap if BOTH lessons exist
  if (originalLessonIndex === -1 || targetLessonIndex === -1) {
    console.error('Cannot swap: one or both lessons not found', {
      originalLessonIndex,
      targetLessonIndex,
      swapRequest
    });
    return;
  }
  
  // Perform bidirectional swap
  const temp = lessons[originalLessonIndex].studentId;
  lessons[originalLessonIndex].studentId = lessons[targetLessonIndex].studentId;
  lessons[targetLessonIndex].studentId = temp;
  
  // Mark lessons as swapped
  const swapDate = new Date().toLocaleDateString('he-IL');

  lessons[originalLessonIndex].isSwapped = true;
  lessons[originalLessonIndex].notes = `שיעור שהוחלף (${swapDate})`;
  lessons[targetLessonIndex].isSwapped = true;
  lessons[targetLessonIndex].notes = `שיעור שהוחלף (${swapDate})`;
  
  // Save to storage
  inMemoryStorage['lessons'] = lessons;
  hybridSync.onDataChange();
  
  console.log('✅ Lesson swap completed successfully', {
    lesson1: lessons[originalLessonIndex],
    lesson2: lessons[targetLessonIndex]
  });
};

// Helper function to calculate end time
const calculateEndTime = (startTime: string, duration: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
};

// Files
export const getFiles = (): FileEntry[] => {
  if (isDevMode()) return devData['files'] || [];
  return inMemoryStorage['files'] || [];
};

export const addFile = (file: Omit<FileEntry, 'id'>): FileEntry => {
  const files = getFiles();
  const newFile: FileEntry = {
    ...file,
    id: generateId(),
    lastModified: new Date().toISOString(),
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

export const updateFile = (id: string, updatedFields: Partial<FileEntry>): FileEntry | undefined => {
  const files = getFiles();
  const fileIndex = files.findIndex(file => file.id === id);

  if (fileIndex === -1) {
    return undefined; // File not found
  }

  files[fileIndex] = { 
    ...files[fileIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['files'] = files;
  } else {
    inMemoryStorage['files'] = files;
    hybridSync.onDataChange();
  }
  return files[fileIndex];
};

export const deleteFile = (id: string): boolean => {
  const files = getFiles();
  const updatedFiles = files.filter(file => file.id !== id);
  if (updatedFiles.length === files.length) {
    return false; // No file was deleted
  }
  if (isDevMode()) {
    devData['files'] = updatedFiles;
  } else {
    inMemoryStorage['files'] = updatedFiles;
    hybridSync.onDataChange();
  }
  return true;
};

// Schedule Templates
export const getScheduleTemplates = (): ScheduleTemplate[] => {
  if (isDevMode()) return devData['scheduleTemplates'] || [];
  return inMemoryStorage['scheduleTemplates'] || [];
};

export const getActiveScheduleTemplate = (): ScheduleTemplate | null => {
  const templates = getScheduleTemplates();
  return templates.find(t => t.isActive) || null;
};

export const addScheduleTemplate = (template: Omit<ScheduleTemplate, 'id' | 'createdAt'>): ScheduleTemplate => {
  const templates = getScheduleTemplates();
   const newTemplate: ScheduleTemplate = {
    ...template,
    id: generateId(),
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
  templates.push(newTemplate);
  if (isDevMode()) {
    devData['scheduleTemplates'] = templates;
  } else {
    inMemoryStorage['scheduleTemplates'] = templates;
    hybridSync.onDataChange();
  }
  return newTemplate;
};

export const activateScheduleTemplate = (id: string): ScheduleTemplate | undefined => {
  const templates = getScheduleTemplates();
  const templateIndex = templates.findIndex(template => template.id === id);

  if (templateIndex === -1) {
    return undefined; // Template not found
  }

  const now = new Date().toISOString();

  // Deactivate all other templates
  templates.forEach((template, index) => {
    if (index !== templateIndex && template.isActive) {
      template.isActive = false;
      template.deactivatedAt = now;
      template.lastModified = now;
    }
  });

  // Activate the selected template
  templates[templateIndex] = { 
    ...templates[templateIndex], 
    isActive: true,
    activatedAt: now,
    lastModified: now
  };
  
  if (isDevMode()) {
    devData['scheduleTemplates'] = templates;
  } else {
    inMemoryStorage['scheduleTemplates'] = templates;
    hybridSync.onDataChange();
  }
  return templates[templateIndex];
};

export const updateScheduleTemplate = (id: string, updatedFields: Partial<ScheduleTemplate>): ScheduleTemplate | undefined => {
  const templates = getScheduleTemplates();
  const templateIndex = templates.findIndex(template => template.id === id);

  if (templateIndex === -1) {
    return undefined; // Template not found
  }

  templates[templateIndex] = { 
    ...templates[templateIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['scheduleTemplates'] = templates;
  } else {
    inMemoryStorage['scheduleTemplates'] = templates;
    hybridSync.onDataChange();
  }
  return templates[templateIndex];
};

export const deleteScheduleTemplate = (id: string): boolean => {
  const templates = getScheduleTemplates();
  const updatedTemplates = templates.filter(template => template.id !== id);
  if (updatedTemplates.length === templates.length) {
    return false; // No template was deleted
  }
  if (isDevMode()) {
    devData['scheduleTemplates'] = updatedTemplates;
  } else {
    inMemoryStorage['scheduleTemplates'] = updatedTemplates;
    hybridSync.onDataChange();
  }
  return true;
};

export const syncStudentWithTemplate = (studentId: string, dayOfWeek: number, timeSlot: string, add: boolean): void => {
  const activeTemplate = getActiveScheduleTemplate();
  if (!activeTemplate) return;

  const dayKey = dayOfWeek.toString();
  
  if (add) {
    // Add student to this time slot
    if (!activeTemplate.schedule[dayKey]) {
      activeTemplate.schedule[dayKey] = {};
    }
    activeTemplate.schedule[dayKey][timeSlot] = {
      studentId,
      duration: 30
    };
  } else {
    // Remove student from this time slot
    if (activeTemplate.schedule[dayKey] && activeTemplate.schedule[dayKey][timeSlot]) {
      delete activeTemplate.schedule[dayKey][timeSlot];
    }
  }

  updateScheduleTemplate(activeTemplate.id, { schedule: activeTemplate.schedule });
};

// Integration Settings
export const getIntegrationSettings = (): IntegrationSettings | null => {
  if (isDevMode()) return devData['integrationSettings'] || null;
  return inMemoryStorage['integrationSettings'] || null;
};

export const saveIntegrationSettings = (settings: IntegrationSettings): void => {
  if (isDevMode()) {
    devData['integrationSettings'] = settings;
  } else {
    inMemoryStorage['integrationSettings'] = settings;
    hybridSync.onDataChange();
  }
};

// User Authentication - Only stored in sessionStorage
export const setCurrentUser = (user: { type: string; studentId?: string; adminId?: string; adminCode?: string } | null): void => {
  sessionStorage.setItem('musicSystem_currentUser', JSON.stringify(user));
  // Also store in localStorage for Worker API access
  if (user) {
    localStorage.setItem('musicSystem_currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('musicSystem_currentUser');
  }
};

export const getCurrentUser = (): { type: string; studentId?: string; adminId?: string; adminCode?: string } | null => {
  const storedUser = sessionStorage.getItem('musicSystem_currentUser');
  return storedUser ? JSON.parse(storedUser) : null;
};

// Helper function to calculate lesson number
export const calculateLessonNumber = (studentId: string, lessonDate: string, lessonId?: string): number => {
  const student = getStudents().find(s => s.id === studentId);
  if (!student) return 0;

  // If student hasn't started yet, return 0
  const startDate = new Date(student.startDate);
  const checkDate = new Date(lessonDate);
  
  if (checkDate < startDate) return 0;

  const lessons = getLessons()
    .filter(lesson => lesson.studentId === studentId && new Date(lesson.date) <= checkDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (lessonId) {
    const lessonIndex = lessons.findIndex(lesson => lesson.id === lessonId);
    return lessonIndex >= 0 ? lessonIndex + (student.startingLessonNumber || 1) : 0;
  }

  return lessons.length + (student.startingLessonNumber || 1) - 1;
};

// Performances
export const getPerformances = (): Performance[] => {
  if (isDevMode()) return devData['performances'] || [];
  return inMemoryStorage['performances'] || [];
};

export const addPerformance = (performance: Omit<Performance, 'id' | 'createdAt'>): Performance => {
  const performances = getPerformances();
  const now = new Date().toISOString();
  const newPerformance: Performance = {
    ...performance,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  performances.push(newPerformance);
  if (isDevMode()) {
    devData['performances'] = performances;
  } else {
    inMemoryStorage['performances'] = performances;
    hybridSync.onDataChange();
  }
  return newPerformance;
};

export const updatePerformance = (id: string, updatedFields: Partial<Performance>): Performance | undefined => {
  const performances = getPerformances();
  const performanceIndex = performances.findIndex(perf => perf.id === id);

  if (performanceIndex === -1) {
    return undefined;
  }

  performances[performanceIndex] = { 
    ...performances[performanceIndex], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['performances'] = performances;
  } else {
    inMemoryStorage['performances'] = performances;
    hybridSync.onDataChange();
  }
  return performances[performanceIndex];
};

export const deletePerformance = (id: string): boolean => {
  const performances = getPerformances();
  const updatedPerformances = performances.filter(perf => perf.id !== id);
  if (updatedPerformances.length === performances.length) {
    return false;
  }
  if (isDevMode()) {
    devData['performances'] = updatedPerformances;
  } else {
    inMemoryStorage['performances'] = updatedPerformances;
    hybridSync.onDataChange();
  }
  return true;
};

// One Time Payments
export const getOneTimePayments = (): OneTimePayment[] => {
  if (isDevMode()) return devData['oneTimePayments'] || [];
  return inMemoryStorage['oneTimePayments'] || [];
};

export const saveOneTimePayments = (payments: OneTimePayment[]): void => {
  if (isDevMode()) {
    devData['oneTimePayments'] = payments;
  } else {
    inMemoryStorage['oneTimePayments'] = payments;
    hybridSync.onDataChange();
  }
};

// Holidays
export const getHolidays = (): Holiday[] => {
  if (isDevMode()) return devData['holidays'] || [];
  return inMemoryStorage['holidays'] || [];
};

export const addHoliday = (date: string, description?: string): Holiday => {
  const holidays = getHolidays();
  const now = new Date().toISOString();
  const newHoliday: Holiday = {
    id: generateId(),
    date,
    description,
    createdAt: now,
    lastModified: now,
  };
  holidays.push(newHoliday);
  if (isDevMode()) {
    devData['holidays'] = holidays;
  } else {
    inMemoryStorage['holidays'] = holidays;
    hybridSync.onDataChange();
  }
  return newHoliday;
};

export const deleteHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  const updatedHolidays = holidays.filter(h => h.date !== date);
  if (updatedHolidays.length === holidays.length) {
    return false;
  }
  if (isDevMode()) {
    devData['holidays'] = updatedHolidays;
  } else {
    inMemoryStorage['holidays'] = updatedHolidays;
    hybridSync.onDataChange();
  }
  return true;
};

export const isHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  return holidays.some(h => h.date === date);
};

// Practice Sessions
export const getPracticeSessions = (): PracticeSession[] => {
  if (isDevMode()) return devData['practiceSessions'] || [];
  return inMemoryStorage['practiceSessions'] || [];
};

export const getStudentPracticeSessions = (studentId: string): PracticeSession[] => {
  const sessions = getPracticeSessions();
  return sessions.filter(s => s.studentId === studentId).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

export const addPracticeSession = (session: Omit<PracticeSession, 'id' | 'createdAt'>): PracticeSession => {
  const sessions = getPracticeSessions();
  const now = new Date().toISOString();
  const newSession: PracticeSession = {
    ...session,
    id: generateId(),
    createdAt: now,
    lastModified: now, // Add timestamp for optimistic locking
  };
  sessions.push(newSession);
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
  
  sessions[index] = { 
    ...sessions[index], 
    ...updatedFields,
    lastModified: new Date().toISOString() // Update timestamp
  };
  if (isDevMode()) {
    devData['practiceSessions'] = sessions;
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    hybridSync.onDataChange();
  }
  return sessions[index];
};

export const deletePracticeSession = (id: string): boolean => {
  const sessions = getPracticeSessions();
  const updatedSessions = sessions.filter(s => s.id !== id);
  if (updatedSessions.length === sessions.length) {
    return false;
  }
  if (isDevMode()) {
    devData['practiceSessions'] = updatedSessions;
  } else {
    inMemoryStorage['practiceSessions'] = updatedSessions;
  }
  // ✅ Always trigger sync (dev + production)
  hybridSync.onDataChange();
  return true;
};

// Monthly Achievements
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
  updates: { maxDailyAverage?: number; maxDailyMinutes?: number; maxStreak?: number }
): void => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const achievements = getMonthlyAchievements();
  const index = achievements.findIndex(a => a.studentId === studentId && a.month === currentMonth);
  const now = new Date().toISOString();
  
  if (index !== -1) {
    const current = achievements[index];
    achievements[index] = {
      ...current,
      maxDailyAverage: Math.max(current.maxDailyAverage, updates.maxDailyAverage || 0),
      maxDailyMinutes: Math.max(current.maxDailyMinutes, updates.maxDailyMinutes || 0),
      maxStreak: Math.max(current.maxStreak, updates.maxStreak || 0),
      updatedAt: now,
      lastModified: now,
    };
  } else {
    const newAchievement: MonthlyAchievement = {
      id: generateId(),
      studentId,
      month: currentMonth,
      maxDailyAverage: updates.maxDailyAverage || 0,
      maxDailyMinutes: updates.maxDailyMinutes || 0,
      maxStreak: updates.maxStreak || 0,
      createdAt: now,
      updatedAt: now,
      lastModified: now,
    };
    achievements.push(newAchievement);
  }
  
  if (isDevMode()) {
    devData['monthlyAchievements'] = achievements;
  } else {
    inMemoryStorage['monthlyAchievements'] = achievements;
    hybridSync.onDataChange();
  }
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
        dailyAverage: a.maxDailyAverage,
        maxDailyMinutes: a.maxDailyMinutes,
        maxStreak: a.maxStreak,
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort((a, b) => b.dailyAverage - a.dailyAverage);
};

export const getCurrentQuarterLeaderboard = (): LeaderboardEntry[] => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  
  // Determine quarter months (Sep-Nov, Dec-Feb, Mar-May, Jun-Aug)
  let quarterMonths: string[];
  if (month >= 8 && month <= 10) {
    // Q1: Sep-Nov
    quarterMonths = [
      `${year}-09`,
      `${year}-10`,
      `${year}-11`
    ];
  } else if (month === 11 || month <= 1) {
    // Q2: Dec-Feb (crosses year boundary)
    const startYear = month === 11 ? year : year - 1;
    quarterMonths = [
      `${startYear}-12`,
      `${startYear + 1}-01`,
      `${startYear + 1}-02`
    ];
  } else if (month >= 2 && month <= 4) {
    // Q3: Mar-May
    quarterMonths = [
      `${year}-03`,
      `${year}-04`,
      `${year}-05`
    ];
  } else {
    // Q4: Jun-Aug
    quarterMonths = [
      `${year}-06`,
      `${year}-07`,
      `${year}-08`
    ];
  }
  
  const achievements = getMonthlyAchievements().filter(a => quarterMonths.includes(a.month));
  const students = getStudents();
  
  // Aggregate achievements by student
  const aggregated = new Map<string, { dailyAverage: number; maxDailyMinutes: number; maxStreak: number }>();
  
  achievements.forEach(a => {
    const existing = aggregated.get(a.studentId);
    if (!existing) {
      aggregated.set(a.studentId, {
        dailyAverage: a.maxDailyAverage,
        maxDailyMinutes: a.maxDailyMinutes,
        maxStreak: a.maxStreak,
      });
    } else {
      aggregated.set(a.studentId, {
        dailyAverage: Math.max(existing.dailyAverage, a.maxDailyAverage),
        maxDailyMinutes: Math.max(existing.maxDailyMinutes, a.maxDailyMinutes),
        maxStreak: Math.max(existing.maxStreak, a.maxStreak),
      });
    }
  });
  
  return Array.from(aggregated.entries())
    .map(([studentId, stats]) => {
      const student = students.find(s => s.id === studentId);
      if (!student) return null;
      
      return {
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        dailyAverage: stats.dailyAverage,
        maxDailyMinutes: stats.maxDailyMinutes,
        maxStreak: stats.maxStreak,
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort((a, b) => b.dailyAverage - a.dailyAverage);
};

// Medal Records
export const getMedalRecords = (): MedalRecord[] => {
  return inMemoryStorage['medalRecords'] || [];
};

export const getStudentMedalRecords = (studentId: string): MedalRecord[] => {
  const records = getMedalRecords();
  return records
    .filter(r => r.studentId === studentId)
    .sort((a, b) => new Date(b.earnedDate).getTime() - new Date(a.earnedDate).getTime());
};

export const addMedalRecord = (record: Omit<MedalRecord, 'id' | 'createdAt'>): MedalRecord => {
  const records = getMedalRecords();
  const now = new Date().toISOString();
  const newRecord: MedalRecord = {
    ...record,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  records.push(newRecord);
  inMemoryStorage['medalRecords'] = records;
  hybridSync.onDataChange();
  return newRecord;
};

export const updateMedalAsUsed = (medalId: string, usedForItem: string): boolean => {
  const records = getMedalRecords();
  const medalIndex = records.findIndex(m => m.id === medalId);
  
  if (medalIndex === -1) return false;
  
  records[medalIndex] = {
    ...records[medalIndex],
    used: true,
    usedDate: new Date().toISOString().split('T')[0],
    usedForItem,
    lastModified: new Date().toISOString()
  };
  
  inMemoryStorage['medalRecords'] = records;
  hybridSync.onDataChange();
  return true;
};

export const refundMedal = (medalId: string): boolean => {
  const records = getMedalRecords();
  const medalIndex = records.findIndex(m => m.id === medalId);
  
  if (medalIndex === -1 || !records[medalIndex].used) return false;
  
  records[medalIndex] = {
    ...records[medalIndex],
    used: false,
    usedDate: undefined,
    usedForItem: undefined,
    lastModified: new Date().toISOString()
  };
  
  inMemoryStorage['medalRecords'] = records;
  hybridSync.onDataChange();
  return true;
};

export const getStudentBestAchievements = (studentId: string): {
  bestDailyAverage: number;
  bestDailyMinutes: number;
  bestStreak: number;
} => {
  const achievements = getStudentMonthlyAchievements(studentId);
  
  if (achievements.length === 0) {
    return { bestDailyAverage: 0, bestDailyMinutes: 0, bestStreak: 0 };
  }
  
  return {
    bestDailyAverage: Math.max(...achievements.map(a => a.maxDailyAverage)),
    bestDailyMinutes: Math.max(...achievements.map(a => a.maxDailyMinutes)),
    bestStreak: Math.max(...achievements.map(a => a.maxStreak)),
  };
};

// Clear practice and medal data - for fresh start
export const clearPracticeAndMedalData = async (): Promise<void> => {
  logger.info('🧹 Clearing all practice sessions, monthly achievements, and medal records...');
  
  inMemoryStorage['practiceSessions'] = [];
  inMemoryStorage['monthlyAchievements'] = [];
  inMemoryStorage['medalRecords'] = [];
  
  // Only sync if we have students (otherwise it's an empty system)
  const students = getStudents();
  if (students && students.length > 0) {
    await hybridSync.onDataChange();
    logger.info('✅ Practice data cleared and synced');
  } else {
    logger.info('ℹ️ Practice data cleared (no sync - empty system)');
  }
};

// Student Statistics Cache
export const saveStudentStatistics = (studentId: string, stats: {
  intervals: any[];
  streak: number;
  maxDaily: number;
  monthly: Record<string, any>;
  yearly: any[];
  weeklyAverage: number;
}) => {
  if (isDevMode()) {
    if (!devData['studentStats']) devData['studentStats'] = {};
    devData['studentStats'][studentId] = {
      ...stats,
      lastUpdated: new Date().toISOString()
    };
  } else {
    if (!inMemoryStorage['studentStats']) inMemoryStorage['studentStats'] = {};
    inMemoryStorage['studentStats'][studentId] = {
      ...stats,
      lastUpdated: new Date().toISOString()
    };
    hybridSync.onDataChange();
  }
};

export const getStudentStatistics = (studentId: string) => {
  if (isDevMode()) {
    return devData['studentStats']?.[studentId] || null;
  }
  return inMemoryStorage['studentStats']?.[studentId] || null;
};

// Tithe Paid Management
export const getTithePaid = (): Record<string, boolean> => {
  if (isDevMode()) return devData['tithePaid'] || {};
  return inMemoryStorage['tithePaid'] || {};
};

export const saveTithePaid = (tithePaid: Record<string, boolean>): void => {
  if (isDevMode()) {
    devData['tithePaid'] = tithePaid;
  } else {
    inMemoryStorage['tithePaid'] = tithePaid;
    hybridSync.onDataChange();
  }
};

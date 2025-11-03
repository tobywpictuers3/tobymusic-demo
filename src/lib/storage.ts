import { Student, Lesson, Payment, SwapRequest, FileEntry, ScheduleTemplate, IntegrationSettings, Performance, OneTimePayment, Holiday, PracticeSession, MonthlyAchievement, LeaderboardEntry, MedalRecord } from './types';
import { hybridSync } from './hybridSync';
import { logger } from './logger';

// Utility function to simulate server-side ID generation
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Students
export const getStudents = (): Student[] => {
  const storedStudents = localStorage.getItem('musicSystem_students');
  return storedStudents ? JSON.parse(storedStudents) : [];
};

export const addStudent = (student: Omit<Student, 'id'>): Student => {
  const students = getStudents();
  const newStudent: Student = {
    ...student,
    id: generateId(),
  };
  students.push(newStudent);
  localStorage.setItem('musicSystem_students', JSON.stringify(students));
  hybridSync.onDataChange();
  return newStudent;
};

export const updateStudent = (id: string, updatedFields: Partial<Student>): Student | undefined => {
  const students = getStudents();
  const studentIndex = students.findIndex(student => student.id === id);

  if (studentIndex === -1) {
    return undefined; // Student not found
  }

  // Update the student with the provided fields
  students[studentIndex] = { ...students[studentIndex], ...updatedFields };
  localStorage.setItem('musicSystem_students', JSON.stringify(students));
  hybridSync.onDataChange();
  return students[studentIndex];
};

export const deleteStudent = (id: string): boolean => {
  const students = getStudents();
  const updatedStudents = students.filter(student => student.id !== id);
  if (updatedStudents.length === students.length) {
    return false; // No student was deleted
  }
  localStorage.setItem('musicSystem_students', JSON.stringify(updatedStudents));
  hybridSync.onDataChange();
  return true;
};

// Update student bank time with notes (feature removed)
export const updateStudentBankTime = (studentId: string, changeInMinutes: number): boolean => {
  // Bank time feature has been removed
  return false;
};

// Lessons
export const getLessons = (): Lesson[] => {
  const storedLessons = localStorage.getItem('musicSystem_lessons');
  return storedLessons ? JSON.parse(storedLessons) : [];
};

export const addLesson = (lesson: Omit<Lesson, 'id'>): Lesson => {
  const lessons = getLessons();
  const newLesson: Lesson = {
    ...lesson,
    id: generateId(),
  };
  lessons.push(newLesson);
  localStorage.setItem('musicSystem_lessons', JSON.stringify(lessons));
  hybridSync.onDataChange();
  return newLesson;
};

export const updateLesson = (id: string, updatedFields: Partial<Lesson>): Lesson | undefined => {
  const lessons = getLessons();
  const lessonIndex = lessons.findIndex(lesson => lesson.id === id);

  if (lessonIndex === -1) {
    return undefined; // Lesson not found
  }

  lessons[lessonIndex] = { ...lessons[lessonIndex], ...updatedFields };
  localStorage.setItem('musicSystem_lessons', JSON.stringify(lessons));
  hybridSync.onDataChange();
  return lessons[lessonIndex];
};

export const deleteLesson = (id: string): boolean => {
  const lessons = getLessons();
  const updatedLessons = lessons.filter(lesson => lesson.id !== id);
  if (updatedLessons.length === lessons.length) {
    return false; // No lesson was deleted
  }
  localStorage.setItem('musicSystem_lessons', JSON.stringify(updatedLessons));
  hybridSync.onDataChange();
  return true;
};

// Payments
export const getPayments = (): Payment[] => {
  const storedPayments = localStorage.getItem('musicSystem_payments');
  return storedPayments ? JSON.parse(storedPayments) : [];
};

export const savePayments = (payments: Payment[]): void => {
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  hybridSync.onDataChange();
};

export const addPayment = (payment: Omit<Payment, 'id'>): Payment => {
  const payments = getPayments();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
  };
  payments.push(newPayment);
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  hybridSync.onDataChange();
  return newPayment;
};

export const updatePayment = (studentId: string, month: string, updatedFields: Partial<Payment>): Payment | undefined => {
  const payments = getPayments();
  const paymentIndex = payments.findIndex(payment => payment.studentId === studentId && payment.month === month);

  if (paymentIndex === -1) {
    // Create new payment if it doesn't exist
    const newPayment: Payment = {
      id: generateId(),
      studentId,
      month,
      amount: 400,
      status: 'pending',
      paymentMethod: 'bank',
      ...updatedFields,
    };
    payments.push(newPayment);
    localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
    hybridSync.onDataChange();
    return newPayment;
  }

  payments[paymentIndex] = { ...payments[paymentIndex], ...updatedFields };
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  hybridSync.onDataChange();
  return payments[paymentIndex];
};

export const deletePayment = (id: string): boolean => {
  const payments = getPayments();
  const updatedPayments = payments.filter(payment => payment.id !== id);
  if (updatedPayments.length === payments.length) {
    return false; // No payment was deleted
  }
  localStorage.setItem('musicSystem_payments', JSON.stringify(updatedPayments));
  hybridSync.onDataChange();
  return true;
};

// Swap Requests
export const getSwapRequests = (): SwapRequest[] => {
  const storedSwapRequests = localStorage.getItem('musicSystem_swapRequests');
  return storedSwapRequests ? JSON.parse(storedSwapRequests) : [];
};

export const addSwapRequest = (swapRequest: Omit<SwapRequest, 'id'>) => {
  const requests = getSwapRequests();
  const newRequest = {
    ...swapRequest,
    id: Date.now().toString(),
  };
  requests.push(newRequest);
  localStorage.setItem('musicSystem_swapRequests', JSON.stringify(requests));
  hybridSync.onDataChange();
  return newRequest;
};

export const updateSwapRequest = (requestId: string, updates: Partial<SwapRequest>) => {
  const requests = getSwapRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);
  
  if (requestIndex === -1) return;
  
  const request = requests[requestIndex];
  requests[requestIndex] = { ...request, ...updates };
  
  // If approved, perform the actual swap
  if (updates.status === 'approved') {
    performLessonSwap(requests[requestIndex]);
  }
  
  localStorage.setItem('musicSystem_swapRequests', JSON.stringify(requests));
  hybridSync.onDataChange();
};

export const updateSwapRequestStatus = (requestId: string, status: 'approved' | 'rejected') => {
  updateSwapRequest(requestId, { status });
};

const performLessonSwap = (swapRequest: SwapRequest) => {
  const lessons = getLessons();
  
  // Find or create the original lesson
  let originalLessonIndex = lessons.findIndex(l => 
    l.studentId === swapRequest.requesterId && 
    l.date === swapRequest.date && 
    l.startTime === swapRequest.time
  );
  
  // If original lesson doesn't exist (it was a template lesson), create it
  if (originalLessonIndex === -1 && swapRequest.targetDate && swapRequest.targetTime) {
    const newLesson = {
      id: generateId(),
      studentId: swapRequest.requesterId,
      date: swapRequest.date,
      startTime: swapRequest.time,
      endTime: calculateEndTime(swapRequest.time, 30),
      status: 'scheduled' as const,
      notes: '',
    };
    lessons.push(newLesson);
    originalLessonIndex = lessons.length - 1;
  }
  
  // Find or create the target lesson
  let targetLessonIndex = -1;
  if (swapRequest.targetDate && swapRequest.targetTime) {
    targetLessonIndex = lessons.findIndex(l => 
      l.studentId === swapRequest.targetId && 
      l.date === swapRequest.targetDate && 
      l.startTime === swapRequest.targetTime
    );
    
    // If target lesson doesn't exist (it was a template lesson), create it
    if (targetLessonIndex === -1) {
      const newLesson = {
        id: generateId(),
        studentId: swapRequest.targetId,
        date: swapRequest.targetDate,
        startTime: swapRequest.targetTime,
        endTime: calculateEndTime(swapRequest.targetTime, 30),
        status: 'scheduled' as const,
        notes: '',
      };
      lessons.push(newLesson);
      targetLessonIndex = lessons.length - 1;
    }
  }
  
  if (originalLessonIndex !== -1 && targetLessonIndex !== -1) {
    // Swap the student IDs
    const originalStudentId = lessons[originalLessonIndex].studentId;
    const targetStudentId = lessons[targetLessonIndex].studentId;
    
    lessons[originalLessonIndex].studentId = targetStudentId;
    lessons[targetLessonIndex].studentId = originalStudentId;
    
    // Add swap notation to both lessons with clear marker
    const swapDate = new Date().toLocaleDateString('he-IL');
    const swapNote = `שיעור שהוחלף (${swapDate})`;
    
    // Replace any existing notes or add the swap note
    lessons[originalLessonIndex].notes = swapNote;
    lessons[targetLessonIndex].notes = swapNote;
    
    localStorage.setItem('musicSystem_lessons', JSON.stringify(lessons));
    // שמירה לדרופבוקס אחרי swap
    hybridSync.onDataChange();
  }
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
  const storedFiles = localStorage.getItem('musicSystem_files');
  return storedFiles ? JSON.parse(storedFiles) : [];
};

export const addFile = (file: Omit<FileEntry, 'id'>): FileEntry => {
  const files = getFiles();
  const newFile: FileEntry = {
    ...file,
    id: generateId(),
  };
  files.push(newFile);
  localStorage.setItem('musicSystem_files', JSON.stringify(files));
  hybridSync.onDataChange();
  return newFile;
};

export const updateFile = (id: string, updatedFields: Partial<FileEntry>): FileEntry | undefined => {
  const files = getFiles();
  const fileIndex = files.findIndex(file => file.id === id);

  if (fileIndex === -1) {
    return undefined; // File not found
  }

  files[fileIndex] = { ...files[fileIndex], ...updatedFields };
  localStorage.setItem('musicSystem_files', JSON.stringify(files));
  hybridSync.onDataChange();
  return files[fileIndex];
};

export const deleteFile = (id: string): boolean => {
  const files = getFiles();
  const updatedFiles = files.filter(file => file.id !== id);
  if (updatedFiles.length === files.length) {
    return false; // No file was deleted
  }
  localStorage.setItem('musicSystem_files', JSON.stringify(updatedFiles));
  hybridSync.onDataChange();
  return true;
};

// Schedule Templates
export const getScheduleTemplates = (): ScheduleTemplate[] => {
  const storedScheduleTemplates = localStorage.getItem('musicSystem_scheduleTemplates');
  return storedScheduleTemplates ? JSON.parse(storedScheduleTemplates) : [];
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
  };
  templates.push(newTemplate);
  localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(templates));
  hybridSync.onDataChange();
  return newTemplate;
};

export const activateScheduleTemplate = (id: string): ScheduleTemplate | undefined => {
  const templates = getScheduleTemplates();
  const templateIndex = templates.findIndex(template => template.id === id);

  if (templateIndex === -1) {
    return undefined; // Template not found
  }

  // Deactivate all other templates
  templates.forEach((template, index) => {
    if (index !== templateIndex && template.isActive) {
      template.isActive = false;
      template.deactivatedAt = new Date().toISOString();
    }
  });

  // Activate the selected template
  templates[templateIndex] = { 
    ...templates[templateIndex], 
    isActive: true,
    activatedAt: new Date().toISOString()
  };
  
  localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(templates));
  hybridSync.onDataChange();
  return templates[templateIndex];
};

export const updateScheduleTemplate = (id: string, updatedFields: Partial<ScheduleTemplate>): ScheduleTemplate | undefined => {
  const templates = getScheduleTemplates();
  const templateIndex = templates.findIndex(template => template.id === id);

  if (templateIndex === -1) {
    return undefined; // Template not found
  }

  templates[templateIndex] = { ...templates[templateIndex], ...updatedFields };
  localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(templates));
  hybridSync.onDataChange();
  return templates[templateIndex];
};

export const deleteScheduleTemplate = (id: string): boolean => {
  const templates = getScheduleTemplates();
  const updatedTemplates = templates.filter(template => template.id !== id);
  if (updatedTemplates.length === templates.length) {
    return false; // No template was deleted
  }
  localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(updatedTemplates));
  hybridSync.onDataChange();
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
  const storedSettings = localStorage.getItem('musicSystem_integrationSettings');
  return storedSettings ? JSON.parse(storedSettings) : null;
};

export const saveIntegrationSettings = (settings: IntegrationSettings): void => {
  localStorage.setItem('musicSystem_integrationSettings', JSON.stringify(settings));
  hybridSync.onDataChange();
};

// User Authentication
export const setCurrentUser = (user: { type: string; studentId?: string; adminId?: string } | null): void => {
  localStorage.setItem('musicSystem_currentUser', JSON.stringify(user));
};

export const getCurrentUser = (): { type: string; studentId?: string; adminId?: string } | null => {
  const storedUser = localStorage.getItem('musicSystem_currentUser');
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
  const storedPerformances = localStorage.getItem('musicSystem_performances');
  return storedPerformances ? JSON.parse(storedPerformances) : [];
};

export const addPerformance = (performance: Omit<Performance, 'id' | 'createdAt'>): Performance => {
  const performances = getPerformances();
  const newPerformance: Performance = {
    ...performance,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  performances.push(newPerformance);
  localStorage.setItem('musicSystem_performances', JSON.stringify(performances));
  hybridSync.onDataChange();
  return newPerformance;
};

export const updatePerformance = (id: string, updatedFields: Partial<Performance>): Performance | undefined => {
  const performances = getPerformances();
  const performanceIndex = performances.findIndex(perf => perf.id === id);

  if (performanceIndex === -1) {
    return undefined;
  }

  performances[performanceIndex] = { ...performances[performanceIndex], ...updatedFields };
  localStorage.setItem('musicSystem_performances', JSON.stringify(performances));
  hybridSync.onDataChange();
  return performances[performanceIndex];
};

export const deletePerformance = (id: string): boolean => {
  const performances = getPerformances();
  const updatedPerformances = performances.filter(perf => perf.id !== id);
  if (updatedPerformances.length === performances.length) {
    return false;
  }
  localStorage.setItem('musicSystem_performances', JSON.stringify(updatedPerformances));
  hybridSync.onDataChange();
  return true;
};

// One Time Payments
export const getOneTimePayments = (): OneTimePayment[] => {
  const stored = localStorage.getItem('oneTimePayments');
  return stored ? JSON.parse(stored) : [];
};

export const saveOneTimePayments = (payments: OneTimePayment[]): void => {
  localStorage.setItem('oneTimePayments', JSON.stringify(payments));
  hybridSync.onDataChange();
};

// Holidays
export const getHolidays = (): Holiday[] => {
  const stored = localStorage.getItem('musicSystem_holidays');
  return stored ? JSON.parse(stored) : [];
};

export const addHoliday = (date: string, description?: string): Holiday => {
  const holidays = getHolidays();
  const newHoliday: Holiday = {
    id: generateId(),
    date,
    description,
    createdAt: new Date().toISOString(),
  };
  holidays.push(newHoliday);
  localStorage.setItem('musicSystem_holidays', JSON.stringify(holidays));
  hybridSync.onDataChange();
  return newHoliday;
};

export const deleteHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  const updatedHolidays = holidays.filter(h => h.date !== date);
  if (updatedHolidays.length === holidays.length) {
    return false;
  }
  localStorage.setItem('musicSystem_holidays', JSON.stringify(updatedHolidays));
  hybridSync.onDataChange();
  return true;
};

export const isHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  return holidays.some(h => h.date === date);
};

// Practice Sessions
export const getPracticeSessions = (): PracticeSession[] => {
  const stored = localStorage.getItem('musicSystem_practiceSessions');
  return stored ? JSON.parse(stored) : [];
};

export const getStudentPracticeSessions = (studentId: string): PracticeSession[] => {
  const sessions = getPracticeSessions();
  return sessions.filter(s => s.studentId === studentId).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

export const addPracticeSession = (session: Omit<PracticeSession, 'id' | 'createdAt'>): PracticeSession => {
  const sessions = getPracticeSessions();
  const newSession: PracticeSession = {
    ...session,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  sessions.push(newSession);
  localStorage.setItem('musicSystem_practiceSessions', JSON.stringify(sessions));
  hybridSync.onDataChange();
  return newSession;
};

export const updatePracticeSession = (id: string, updatedFields: Partial<PracticeSession>): PracticeSession | undefined => {
  const sessions = getPracticeSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return undefined;
  
  sessions[index] = { ...sessions[index], ...updatedFields };
  localStorage.setItem('musicSystem_practiceSessions', JSON.stringify(sessions));
  hybridSync.onDataChange();
  return sessions[index];
};

export const deletePracticeSession = (id: string): boolean => {
  const sessions = getPracticeSessions();
  const updatedSessions = sessions.filter(s => s.id !== id);
  if (updatedSessions.length === sessions.length) {
    return false;
  }
  localStorage.setItem('musicSystem_practiceSessions', JSON.stringify(updatedSessions));
  hybridSync.onDataChange();
  return true;
};

// Monthly Achievements
export const getMonthlyAchievements = (): MonthlyAchievement[] => {
  try {
    const data = localStorage.getItem('musicSystem_monthlyAchievements');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    logger.error('Error loading monthly achievements:', error);
    return [];
  }
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
  
  if (index !== -1) {
    const current = achievements[index];
    achievements[index] = {
      ...current,
      maxDailyAverage: Math.max(current.maxDailyAverage, updates.maxDailyAverage || 0),
      maxDailyMinutes: Math.max(current.maxDailyMinutes, updates.maxDailyMinutes || 0),
      maxStreak: Math.max(current.maxStreak, updates.maxStreak || 0),
      updatedAt: new Date().toISOString(),
    };
  } else {
    const newAchievement: MonthlyAchievement = {
      id: generateId(),
      studentId,
      month: currentMonth,
      maxDailyAverage: updates.maxDailyAverage || 0,
      maxDailyMinutes: updates.maxDailyMinutes || 0,
      maxStreak: updates.maxStreak || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    achievements.push(newAchievement);
  }
  
  localStorage.setItem('musicSystem_monthlyAchievements', JSON.stringify(achievements));
  hybridSync.onDataChange();
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

// Medal Records
export const getMedalRecords = (): MedalRecord[] => {
  try {
    const data = localStorage.getItem('musicSystem_medalRecords');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    logger.error('Error loading medal records:', error);
    return [];
  }
};

export const getStudentMedalRecords = (studentId: string): MedalRecord[] => {
  const records = getMedalRecords();
  return records
    .filter(r => r.studentId === studentId)
    .sort((a, b) => new Date(b.earnedDate).getTime() - new Date(a.earnedDate).getTime());
};

export const addMedalRecord = (record: Omit<MedalRecord, 'id' | 'createdAt'>): MedalRecord => {
  const records = getMedalRecords();
  const newRecord: MedalRecord = {
    ...record,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  records.push(newRecord);
  localStorage.setItem('musicSystem_medalRecords', JSON.stringify(records));
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
    usedForItem
  };
  
  localStorage.setItem('musicSystem_medalRecords', JSON.stringify(records));
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

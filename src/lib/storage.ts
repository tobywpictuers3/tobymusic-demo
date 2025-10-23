import { Student, Lesson, Payment, SwapRequest, FileEntry, ScheduleTemplate, IntegrationSettings, Performance, OneTimePayment, Holiday } from './types';
import { syncManager } from './syncManager';

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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return students[studentIndex];
};

export const deleteStudent = (id: string): boolean => {
  const students = getStudents();
  const updatedStudents = students.filter(student => student.id !== id);
  if (updatedStudents.length === students.length) {
    return false; // No student was deleted
  }
  localStorage.setItem('musicSystem_students', JSON.stringify(updatedStudents));
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return lessons[lessonIndex];
};

export const deleteLesson = (id: string): boolean => {
  const lessons = getLessons();
  const updatedLessons = lessons.filter(lesson => lesson.id !== id);
  if (updatedLessons.length === lessons.length) {
    return false; // No lesson was deleted
  }
  localStorage.setItem('musicSystem_lessons', JSON.stringify(updatedLessons));
  syncManager.onUserAction('update');
  return true;
};

// Payments
export const getPayments = (): Payment[] => {
  const storedPayments = localStorage.getItem('musicSystem_payments');
  return storedPayments ? JSON.parse(storedPayments) : [];
};

export const savePayments = (payments: Payment[]): void => {
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  syncManager.onUserAction('update');
};

export const addPayment = (payment: Omit<Payment, 'id'>): Payment => {
  const payments = getPayments();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
  };
  payments.push(newPayment);
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  syncManager.onUserAction('update');
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
    syncManager.onUserAction('update');
    return newPayment;
  }

  payments[paymentIndex] = { ...payments[paymentIndex], ...updatedFields };
  localStorage.setItem('musicSystem_payments', JSON.stringify(payments));
  syncManager.onUserAction('update');
  return payments[paymentIndex];
};

export const deletePayment = (id: string): boolean => {
  const payments = getPayments();
  const updatedPayments = payments.filter(payment => payment.id !== id);
  if (updatedPayments.length === payments.length) {
    return false; // No payment was deleted
  }
  localStorage.setItem('musicSystem_payments', JSON.stringify(updatedPayments));
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
    syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return files[fileIndex];
};

export const deleteFile = (id: string): boolean => {
  const files = getFiles();
  const updatedFiles = files.filter(file => file.id !== id);
  if (updatedFiles.length === files.length) {
    return false; // No file was deleted
  }
  localStorage.setItem('musicSystem_files', JSON.stringify(updatedFiles));
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return templates[templateIndex];
};

export const deleteScheduleTemplate = (id: string): boolean => {
  const templates = getScheduleTemplates();
  const updatedTemplates = templates.filter(template => template.id !== id);
  if (updatedTemplates.length === templates.length) {
    return false; // No template was deleted
  }
  localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(updatedTemplates));
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return performances[performanceIndex];
};

export const deletePerformance = (id: string): boolean => {
  const performances = getPerformances();
  const updatedPerformances = performances.filter(perf => perf.id !== id);
  if (updatedPerformances.length === performances.length) {
    return false;
  }
  localStorage.setItem('musicSystem_performances', JSON.stringify(updatedPerformances));
  syncManager.onUserAction('update');
  return true;
};

// One Time Payments
export const getOneTimePayments = (): OneTimePayment[] => {
  const stored = localStorage.getItem('oneTimePayments');
  return stored ? JSON.parse(stored) : [];
};

export const saveOneTimePayments = (payments: OneTimePayment[]): void => {
  localStorage.setItem('oneTimePayments', JSON.stringify(payments));
  syncManager.onUserAction('update');
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
  syncManager.onUserAction('update');
  return newHoliday;
};

export const deleteHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  const updatedHolidays = holidays.filter(h => h.date !== date);
  if (updatedHolidays.length === holidays.length) {
    return false;
  }
  localStorage.setItem('musicSystem_holidays', JSON.stringify(updatedHolidays));
  syncManager.onUserAction('update');
  return true;
};

export const isHoliday = (date: string): boolean => {
  const holidays = getHolidays();
  return holidays.some(h => h.date === date);
};

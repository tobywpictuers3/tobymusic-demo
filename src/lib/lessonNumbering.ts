
import { getLessons, getStudents, updateLesson, addLesson, updateStudentBankTime } from './storage';
import { Lesson, Student } from './types';

export interface LessonNumberingResult {
  lessonNumber: number;
  isBankTimeLesson: boolean;
  isSkippedLesson: boolean;
  bankTimeChange?: number;
}

// Calculate lesson number with future lesson support and bank time conversions
export const calculateEnhancedLessonNumber = (
  studentId: string, 
  lessonDate: string, 
  lessonId?: string
): LessonNumberingResult => {
  const student = getStudents().find(s => s.id === studentId);
  if (!student) return { lessonNumber: 0, isBankTimeLesson: false, isSkippedLesson: false };

  const startDate = new Date(student.startDate);
  const checkDate = new Date(lessonDate);
  
  if (checkDate < startDate) {
    return { lessonNumber: 0, isBankTimeLesson: false, isSkippedLesson: false };
  }

  const allLessons = getLessons()
    .filter(lesson => lesson.studentId === studentId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Check if student has received any lessons (not just scheduled)
  const completedLessons = allLessons.filter(l => l.status === 'completed');
  const hasReceivedLessons = completedLessons.length > 0;

  if (!hasReceivedLessons) {
    return { lessonNumber: 0, isBankTimeLesson: false, isSkippedLesson: false };
  }

  // For existing lessons, use their locked number or calculate position
  if (lessonId) {
    const lesson = allLessons.find(l => l.id === lessonId);
    if (lesson?.lockedNumber) {
      return { 
        lessonNumber: lesson.lockedNumber, 
        isBankTimeLesson: lesson.notes?.includes('תוספת בנק זמן') || false,
        isSkippedLesson: lesson.notes?.includes('דילוג מיספור') || false
      };
    }
  }

  // Calculate lesson position including future lessons
  const lessonPosition = allLessons.findIndex(l => 
    lessonId ? l.id === lessonId : l.date === lessonDate
  );
  
  if (lessonPosition === -1) {
    // For new lessons, add to the end
    return { 
      lessonNumber: allLessons.length + (student.startingLessonNumber || 1),
      isBankTimeLesson: false,
      isSkippedLesson: false
    };
  }

  // Count lessons up to this position, excluding skipped ones
  let lessonNumber = student.startingLessonNumber || 1;
  for (let i = 0; i <= lessonPosition; i++) {
    const currentLesson = allLessons[i];
    if (!currentLesson.notes?.includes('דילוג מיספור')) {
      if (i === lessonPosition) {
        return { 
          lessonNumber,
          isBankTimeLesson: currentLesson.notes?.includes('תוספת בנק זמן') || false,
          isSkippedLesson: false
        };
      }
      lessonNumber++;
    } else if (i === lessonPosition) {
      return { 
        lessonNumber: 0, // Skipped lessons don't get a number
        isBankTimeLesson: false,
        isSkippedLesson: true
      };
    }
  }

  return { lessonNumber, isBankTimeLesson: false, isSkippedLesson: false };
};

// Handle bank time to lesson conversion (when bank time >= 30 minutes)
export const convertBankTimeToLesson = (studentId: string): boolean => {
  const student = getStudents().find(s => s.id === studentId);
  if (!student) return false; // Bank time feature removed

  const lessons = getLessons()
    .filter(l => l.studentId === studentId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find the last lesson where bank time was added
  const lastBankTimeAddition = lessons
    .reverse()
    .find(l => l.notes?.includes('עדכון בנק זמן: +'));

  if (!lastBankTimeAddition) return false;

  // Create duplicate lesson for bank time conversion
  const duplicateLesson: Omit<Lesson, 'id'> = {
    studentId,
    date: lastBankTimeAddition.date,
    startTime: lastBankTimeAddition.startTime,
    endTime: lastBankTimeAddition.endTime,
    notes: `${lastBankTimeAddition.notes || ''} (תוספת בנק זמן - ${new Date().toLocaleDateString('he-IL')})`,
    isOneOff: true,
    status: 'completed'
  };

  const newLesson = addLesson(duplicateLesson);
  
  // Update student bank time (subtract 30 minutes)
  updateStudentBankTime(studentId, -30);

  return true;
};

// Handle lesson skipping for negative bank time
export const handleNegativeBankTime = (studentId: string, lessonId: string): boolean => {
  const student = getStudents().find(s => s.id === studentId);
  if (!student) return false; // Bank time feature removed

  const lessons = getLessons().filter(l => l.studentId === studentId);
  const targetLesson = lessons.find(l => l.id === lessonId);
  
  if (!targetLesson) return false;

  // Mark lesson as skipped (bank time feature removed)
  const remainingMinutes = 0;
  
  updateLesson(lessonId, {
    notes: `${targetLesson.notes || ''} (דילוג מיספור - החסרה בבנק זמן - ${new Date().toLocaleDateString('he-IL')})`,
    status: 'cancelled'
  });

  // Add remaining minutes to bank time
  if (remainingMinutes > 0) {
    updateStudentBankTime(studentId, remainingMinutes);
  }

  return true;
};

// Auto-manage bank time conversions (feature removed)
export const autoManageBankTime = (studentId: string): void => {
  // Bank time feature has been removed
  return;
};

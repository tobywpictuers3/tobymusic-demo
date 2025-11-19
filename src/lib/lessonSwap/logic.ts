import { SwapRequest } from './types';
import { Lesson, Student } from '../types';
import { logger } from '../logger';

export const validateSwap = (
  request: Omit<SwapRequest, 'id' | 'createdAt'>,
  lessons: Lesson[],
  students: Student[]
): { valid: boolean; error?: string } => {
  // Check requester lesson exists
  const requesterLesson = lessons.find(l => l.id === request.requesterLessonId);
  if (!requesterLesson) {
    return { valid: false, error: 'השיעור שלך לא נמצא במערכת' };
  }
  
  // Check target lesson exists
  const targetLesson = lessons.find(l => l.id === request.targetLessonId);
  if (!targetLesson) {
    return { valid: false, error: 'השיעור המבוקש לא נמצא במערכת' };
  }
  
  // Check requester owns the lesson
  if (requesterLesson.studentId !== request.requesterStudentId) {
    return { valid: false, error: 'השיעור שלך לא שייך לך' };
  }
  
  // Check target lesson belongs to target student
  if (targetLesson.studentId !== request.targetStudentId) {
    return { valid: false, error: 'השיעור המבוקש לא שייך לתלמידה שצוינה' };
  }
  
  // Check both lessons are scheduled
  if (requesterLesson.status !== 'scheduled') {
    return { valid: false, error: 'ניתן להחליף רק שיעורים מתוכננים' };
  }
  
  if (targetLesson.status !== 'scheduled') {
    return { valid: false, error: 'השיעור המבוקש אינו מתוכנן' };
  }
  
  // Check requester swap code
  const requester = students.find(s => s.id === request.requesterStudentId);
  if (!requester) {
    return { valid: false, error: 'תלמידה מבקשת לא נמצאה' };
  }
  
  const requesterCode = requester.swapCode || requester.personalCode;
  if (request.requesterSwapCode !== requesterCode) {
    return { valid: false, error: 'קוד ההחלפה שלך שגוי' };
  }
  
  // If target swap code provided, validate it
  if (request.targetSwapCode) {
    const targetStudent = students.find(s => s.id === request.targetStudentId);
    if (!targetStudent) {
      return { valid: false, error: 'תלמידה מבוקשת לא נמצאה' };
    }
    
    const targetCode = targetStudent.swapCode || targetStudent.personalCode;
    if (request.targetSwapCode !== targetCode) {
      return { valid: false, error: 'קוד ההחלפה של התלמידה השנייה שגוי' };
    }
  }
  
  return { valid: true };
};

export const determineSwapStatus = (
  request: Omit<SwapRequest, 'id' | 'createdAt'>,
  students: Student[]
): 'auto_approved' | 'pending_manager' => {
  // If target swap code is provided and valid, auto-approve
  if (request.targetSwapCode) {
    const targetStudent = students.find(s => s.id === request.targetStudentId);
    if (targetStudent) {
      const targetCode = targetStudent.swapCode || targetStudent.personalCode;
      if (request.targetSwapCode === targetCode) {
        logger.info('✅ Swap auto-approved with valid target code');
        return 'auto_approved';
      }
    }
  }
  
  logger.info('⏳ Swap requires manager approval');
  return 'pending_manager';
};

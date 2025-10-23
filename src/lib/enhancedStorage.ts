
import { 
  updateStudent as originalUpdateStudent,
  updateStudentBankTime as originalUpdateStudentBankTime,
  addLesson as originalAddLesson,
  updateLesson as originalUpdateLesson
} from './storage';
import { autoManageBankTime } from './lessonNumbering';
import { Student, Lesson } from './types';

// Enhanced bank time update with automatic conversions
export const updateStudentBankTimeEnhanced = (
  studentId: string, 
  changeInMinutes: number
): boolean => {
  const result = originalUpdateStudentBankTime(studentId, changeInMinutes);
  
  if (result) {
    // Auto-manage bank time conversions after update
    autoManageBankTime(studentId);
  }
  
  return result;
};

// Enhanced lesson addition with bank time management
export const addLessonEnhanced = (lesson: Omit<Lesson, 'id'>): Lesson => {
  const newLesson = originalAddLesson(lesson);
  
  // Check if this triggers bank time management
  autoManageBankTime(lesson.studentId);
  
  return newLesson;
};

// Enhanced lesson update with bank time management
export const updateLessonEnhanced = (
  id: string, 
  updatedFields: Partial<Lesson>
): Lesson | undefined => {
  const result = originalUpdateLesson(id, updatedFields);
  
  if (result) {
    // Auto-manage bank time after lesson updates
    autoManageBankTime(result.studentId);
  }
  
  return result;
};

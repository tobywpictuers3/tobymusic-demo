import { Lesson, Student } from './types';
import { getLessons, getStudents, getActiveScheduleTemplate } from './storage';

/**
 * Calculate end time for a lesson based on start time and duration
 */
const calculateEndTime = (startTime: string, duration: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
};

/**
 * Get all lessons including template-based lessons for upcoming weeks
 * This function consolidates the logic used by GeneralWeeklySchedule and StudentSwapPanel
 * 
 * @param weeks - Number of weeks ahead to generate template lessons (default: 4)
 * @returns Array of all lessons (actual + template lessons)
 */
export function getAllLessonsIncludingTemplates(weeks: number = 4): Lesson[] {
  const actualLessons = getLessons();
  const activeTemplate = getActiveScheduleTemplate();
  const students = getStudents();
  const templateLessons: Lesson[] = [];
  
  if (!activeTemplate) {
    return actualLessons;
  }
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Generate template lessons for the next `weeks` weeks
  for (let dayOffset = 0; dayOffset < weeks * 7; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Only generate future lessons
    if (dateStr < currentDate) {
      continue;
    }
    
    const dayOfWeek = date.getDay();
    const dayKey = dayOfWeek.toString();
    const daySchedule = activeTemplate.schedule[dayKey] || {};
    
    Object.entries(daySchedule).forEach(([time, data]) => {
      const student = students.find(s => s.id === data.studentId);
      if (!student) return;
      
      const lessonDate = new Date(dateStr);
      const studentStartDate = new Date(student.startDate);
      
      // Skip if lesson is before student's start date
      if (lessonDate < studentStartDate) {
        return;
      }
      
      // Calculate end date (end of school year or explicit end date)
      const getEndOfSchoolYear = (startDate: string): Date => {
        const start = new Date(startDate);
        const year = start.getFullYear();
        const month = start.getMonth();
        const endYear = month >= 8 ? year + 1 : year;
        return new Date(`${endYear}-08-31`);
      };
      
      const effectiveEndDate = student.endDate 
        ? new Date(student.endDate)
        : getEndOfSchoolYear(student.startDate);
      
      // Skip if lesson is after student's end date
      if (lessonDate > effectiveEndDate) {
        return;
      }
      
      // Check if there's an existing actual lesson at this time
      const existingLesson = actualLessons.find(
        l => l.date === dateStr && l.startTime === time && l.studentId === data.studentId
      );
      
      // Skip if there's a cancelled lesson at this time
      if (existingLesson && existingLesson.status === 'cancelled') {
        return;
      }
      
      // Only create template lesson if no existing actual lesson
      if (!existingLesson) {
        const endTime = calculateEndTime(time, 30);
        
        templateLessons.push({
          id: `template-${dateStr}-${time}-${data.studentId}`,
          studentId: data.studentId,
          date: dateStr,
          startTime: time,
          endTime,
          status: 'scheduled',
          isFromTemplate: true
        });
      }
    });
  }
  
  return [...actualLessons, ...templateLessons];
}

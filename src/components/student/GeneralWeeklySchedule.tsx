import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { getLessons, getStudents, getActiveScheduleTemplate } from '@/lib/storage';
import { Lesson, Student } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import StudentsSwapRequestDialog from '@/components/students/StudentsSwapRequestDialog';

interface GeneralWeeklyScheduleProps {
  studentId?: string;
  onLessonDoubleClick?: (lesson: Lesson) => void;
  isSelectionActive?: boolean;
  currentSwapStep?: 1 | 2 | 3 | 4;
}

const GeneralWeeklySchedule: React.FC<GeneralWeeklyScheduleProps> = ({ studentId, onLessonDoubleClick, isSelectionActive, currentSwapStep = 1 }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [selectedLessonForSwap, setSelectedLessonForSwap] = useState<Lesson | null>(null);

  useEffect(() => {
    const lessonsData = getLessons();
    const studentsData = getStudents();
    
    setLessons(lessonsData);
    setStudents(studentsData);
  }, []);

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeek);
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצאי שבת'];

  const calculateEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const getLessonsForDay = (date: Date): Lesson[] => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Only show future lessons (not past)
    const currentDate = new Date().toISOString().split('T')[0];
    if (dateStr < currentDate) {
      return [];
    }
    
    // Get template lessons
    const activeTemplate = getActiveScheduleTemplate();
    const templateLessons: Lesson[] = [];
    
    if (activeTemplate) {
      const dayOfWeek = date.getDay();
      const dayKey = dayOfWeek.toString();
      const daySchedule = activeTemplate.schedule[dayKey] || {};
      
      Object.entries(daySchedule).forEach(([time, data]) => {
        const student = students.find(s => s.id === data.studentId);
        if (!student) return;
        
        const lessonDate = new Date(dateStr);
        const studentStartDate = new Date(student.startDate);
        
        if (lessonDate < studentStartDate) {
          return;
        }
        
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
        
        if (lessonDate > effectiveEndDate) {
          return;
        }
        
        const existingLesson = lessons.find(
          l => l.date === dateStr && l.startTime === time && l.studentId === data.studentId
        );
        
        if (existingLesson && existingLesson.status === 'cancelled') {
          return;
        }
        
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
    
    const actualLessons: Lesson[] = lessons
      .filter(l => l.date === dateStr && l.status !== 'cancelled')
      .filter(l => {
        const student = students.find(s => s.id === l.studentId);
        return student !== undefined;
      });
    
    const allLessons = [...templateLessons, ...actualLessons];
    
    return allLessons.sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const getStudentDetails = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? {
      name: `${student.firstName} ${student.lastName}`,
      phone: student.phone,
      email: student.email
    } : null;
  };

  const handlePrevWeek = () => {
    const prevWeek = new Date(currentWeek);
    prevWeek.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(prevWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(nextWeek);
  };

  const isSwappedLesson = (lesson: Lesson) => {
    return lesson.isSwapped || lesson.notes?.includes('שיעור שהוחלף') || lesson.notes?.includes('החלפה');
  };

  const handleLessonClick = (lesson: Lesson) => {
    const currentDate = new Date().toISOString().split('T')[0];
    if (lesson.date >= currentDate) {
      setSelectedLessonForSwap(lesson);
      if (onLessonDoubleClick) {
        // Use new swap panel logic
        onLessonDoubleClick(lesson);
      } else {
        // Fallback to old dialog
        setSelectedLesson(lesson);
        setSwapDialogOpen(true);
      }
    }
  };

  const currentDate = new Date().toISOString().split('T')[0];

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          מערכת שיעורים שבועית
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          לחצי על שיעור לבחירה לבקשת החלפה
        </p>
      </CardHeader>
      <CardContent>
        {/* Week Navigation */}
        <div className="flex justify-between items-center mb-6">
          <Button onClick={handleNextWeek} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 ml-2" />
            שבוע הבא
          </Button>
          <h3 className="text-lg font-semibold">
            {weekDates[0].toLocaleDateString('he-IL')} - {weekDates[6].toLocaleDateString('he-IL')}
          </h3>
          <Button onClick={handlePrevWeek} variant="outline" size="sm">
            שבוע קודם
            <ArrowRight className="h-4 w-4 mr-2" />
          </Button>
        </div>

        {/* Weekly Calendar Grid */}
        <div className="grid grid-cols-7 gap-2" dir="rtl">
          {weekDates.map((date, index) => {
            const dayLessons = getLessonsForDay(date);
            return (
              <div key={date.toISOString()} className="space-y-1">
                <div className="text-center p-2 bg-secondary/50 rounded-lg">
                  <div className="font-semibold text-sm">{dayNames[index]}</div>
                  <div className="text-xs text-muted-foreground">
                    {date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                  </div>
                </div>
                <div className="space-y-1 min-h-[150px]">
                  {dayLessons
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((lesson) => {
                      const studentDetails = getStudentDetails(lesson.studentId);
                      if (!studentDetails) return null;

                      const isFuture = lesson.date > currentDate;
                      const isCompleted = lesson.status === 'completed';
                      const isSwapped = isSwappedLesson(lesson);
                      
                      // Determine if lesson is clickable based on currentSwapStep
                      const isClickableForSelection = 
                        isSelectionActive && 
                        isFuture && 
                        onLessonDoubleClick && 
                        (
                          (currentSwapStep === 2 && lesson.studentId === studentId) ||
                          (currentSwapStep === 3 && lesson.studentId !== studentId)
                        );
                      
                      const isClickable = isFuture && onLessonDoubleClick;
                      const isSelected = selectedLessonForSwap?.id === lesson.id;

                      return (
                        <div
                          key={lesson.id}
                          className={`p-2 border-2 rounded-lg text-xs transition-all duration-200 hover:shadow-md ${
                            isSelected
                              ? 'bg-primary/20 border-primary border-4 shadow-lg ring-2 ring-primary ring-offset-2'
                              : isSwapped 
                                ? 'bg-[#8B4513]/10 border-[#8B4513] text-[#8B4513]' 
                                : isFuture 
                                  ? 'bg-white/50 text-gray-700 border-gray-300' 
                                  : isCompleted 
                                    ? 'bg-[#FFD700]/10 border-[#FFD700] text-gray-900' 
                                    : 'bg-white border-gray-400 text-black'
                          } ${isClickable ? 'cursor-pointer hover:scale-105' : ''} ${
                            isSelectionActive && isClickable 
                              ? 'ring-2 ring-primary ring-offset-2 animate-pulse' 
                              : ''
                          }`}
                          onClick={() => isClickable && handleLessonClick(lesson)}
                          title={isClickable ? "לחצי לבחירת שיעור להחלפה" : ""}
                        >
                          <div className="space-y-1">
                            <div className="font-bold text-base text-black">
                              {studentDetails.name}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {studentDetails.email}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {studentDetails.phone}
                            </div>
                            <div className="text-sm font-bold mt-2 text-black">
                              {lesson.startTime} - {lesson.endTime}
                            </div>
                            <div className="flex gap-1 flex-wrap mt-1">
                              {isClickableForSelection && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white animate-pulse">
                                  לחצי כאן
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-primary text-white">
                                  ✓ נבחר
                                </Badge>
                              )}
                              {isSwapped && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white border-orange-500">
                                  הוחלף
                                </Badge>
                              )}
                              {lesson.isOneOff && (
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-[#FFD700] text-black border-[#FFD700]">
                                  חד פעמי
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

      </CardContent>

      {/* Swap Request Dialog */}
      <StudentsSwapRequestDialog
        open={swapDialogOpen}
        onOpenChange={setSwapDialogOpen}
        selectedLesson={selectedLesson}
      />
    </Card>
  );
};

export default GeneralWeeklySchedule;

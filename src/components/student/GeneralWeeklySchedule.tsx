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
}

const GeneralWeeklySchedule: React.FC<GeneralWeeklyScheduleProps> = ({ studentId }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);

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
    return lesson.notes?.includes('שיעור שהוחלף') || lesson.notes?.includes('החלפה');
  };

  const handleLessonDoubleClick = (lesson: Lesson) => {
    const currentDate = new Date().toISOString().split('T')[0];
    if (lesson.date >= currentDate) {
      setSelectedLesson(lesson);
      setSwapDialogOpen(true);
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
          לחיצה כפולה על שיעור לבקשת החלפה
        </p>
      </CardHeader>
      <CardContent>
        {/* Week Navigation */}
        <div className="flex justify-between items-center mb-6">
          <Button onClick={handlePrevWeek} variant="outline" size="sm">
            <ArrowRight className="h-4 w-4" />
            שבוע קודם
          </Button>
          <h3 className="text-lg font-semibold">
            {weekDates[0].toLocaleDateString('he-IL')} - {weekDates[6].toLocaleDateString('he-IL')}
          </h3>
          <Button onClick={handleNextWeek} variant="outline" size="sm">
            שבוע הבא
            <ArrowLeft className="h-4 w-4 mr-2" />
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

                      return (
                        <div
                          key={lesson.id}
                          className={`p-2 border-2 rounded-lg text-xs cursor-pointer transition-all duration-200 hover:shadow-md ${
                            isSwapped 
                              ? 'bg-[#8B4513]/10 border-[#8B4513] text-[#8B4513]' 
                              : isFuture 
                                ? 'bg-white/50 text-gray-700 border-gray-300' 
                                : isCompleted 
                                  ? 'bg-[#FFD700]/10 border-[#FFD700] text-gray-900' 
                                  : 'bg-white border-gray-400 text-black'
                          }`}
                          onDoubleClick={() => handleLessonDoubleClick(lesson)}
                          title="לחץ פעמיים לבקשת החלפה"
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
                            {isSwapped && (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-[#8B4513] text-white border-[#8B4513]">
                                מוחלף
                              </Badge>
                            )}
                            {lesson.isOneOff && (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-[#FFD700] text-black border-[#FFD700]">
                                חד פעמי
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg border-2 border-gray-300">
          <div className="text-sm text-gray-900 space-y-1 font-medium">
            <p>🔄 <strong className="text-[#8B4513]">שיעורים מוחלפים</strong> - שיעורים שהוחלפו בין תלמידות</p>
            <p>🏆 <strong className="text-[#FFD700]">שיעורים שהושלמו</strong> - שיעורים שכבר התקיימו</p>
            <p>⚪ <strong>שיעורי עתיד</strong> - שיעורים מתוכננים</p>
            <p>💡 <strong>לחיצה כפולה על שיעור עתידי</strong> - לבקשת החלפה עם אימות קוד אישי</p>
          </div>
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

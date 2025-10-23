
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { getLessons, getStudents, getActiveScheduleTemplate } from '@/lib/storage';
import { Lesson, Student } from '@/lib/types';
import StudentsSwapRequestDialog from '@/components/students/StudentsSwapRequestDialog';
import BackButton from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { calculateEnhancedLessonNumber } from '@/lib/lessonNumbering';
import { PrintPDFButton } from '@/components/ui/print-pdf-button';

const StudentsViewSystem = () => {
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
        
        // Check if lesson date is within student's active period
        const lessonDate = new Date(dateStr);
        const studentStartDate = new Date(student.startDate);
        
        // Don't show lessons before student's start date
        if (lessonDate < studentStartDate) {
          return;
        }
        
        // Calculate end date: use student's endDate or end of school year
        const getEndOfSchoolYear = (startDate: string): Date => {
          const start = new Date(startDate);
          const year = start.getFullYear();
          const month = start.getMonth(); // 0-11
          
          // If start is September or later (month >= 8), end is August 31 of next year
          // Otherwise, end is August 31 of same year
          const endYear = month >= 8 ? year + 1 : year;
          return new Date(`${endYear}-08-31`);
        };
        
        const effectiveEndDate = student.endDate 
          ? new Date(student.endDate)
          : getEndOfSchoolYear(student.startDate);
        
        // Don't show lessons after the effective end date
        if (lessonDate > effectiveEndDate) {
          return;
        }
        
        const existingLesson = lessons.find(
          l => l.date === dateStr && l.startTime === time && l.studentId === data.studentId
        );
        
        // Don't show template lesson if it was cancelled
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
    
    // Get actual lessons (filter out cancelled ones from display)
    const actualLessons: Lesson[] = lessons
      .filter(l => l.date === dateStr && l.status !== 'cancelled')
      .filter(l => {
        // Only show lessons for valid students
        const student = students.find(s => s.id === l.studentId);
        return student !== undefined;
      });
    
    // Combine and sort
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

  const handleLessonDoubleClick = (lesson: Lesson) => {
    const currentDate = new Date().toISOString().split('T')[0];
    // Only allow swap requests for future lessons
    if (lesson.date >= currentDate) {
      setSelectedLesson(lesson);
      setSwapDialogOpen(true);
    }
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

  const currentDate = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen musical-gradient">
      <div className="max-h-screen overflow-y-auto">
        <div className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <Card className="card-gradient card-shadow">
            <CardHeader>
              <div className="flex justify-between items-center">
                <BackButton to="/" label="חזור לדף הבית" />
                <h1 className="text-3xl font-bold text-primary crown-glow">
                  מערכת שיעורי נגינה - טובי וינברג
                </h1>
                <PrintPDFButton contentId="lessons-journal" tabName="יומן שיעורים" />
              </div>
            </CardHeader>
          </Card>

          {/* Weekly Schedule */}
          <Card className="card-gradient card-shadow" id="lessons-journal">
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
                            
                            // Only calculate lesson numbers for completed lessons
                            const lessonResult = isCompleted ? calculateEnhancedLessonNumber(lesson.studentId, lesson.date, lesson.id) : null;

                            return (
                              <div
                                key={lesson.id}
                                className={`p-2 border rounded text-xs cursor-pointer transition-all duration-200 hover:shadow-sm ${
                                  isSwapped 
                                    ? 'bg-orange-50 border-orange-200 text-orange-900' 
                                    : isFuture 
                                      ? 'bg-muted/50 text-muted-foreground border-muted/30' 
                                      : isCompleted 
                                        ? 'bg-blue-50 border-blue-200 text-blue-900' 
                                        : 'bg-primary/10 border-primary/20 text-black'
                                }`}
                                onDoubleClick={() => handleLessonDoubleClick(lesson)}
                                title="לחץ פעמיים לבקשת החלפה"
                              >
                                <div className="space-y-1">
                                  <div className="font-semibold text-sm">
                                    {studentDetails.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {studentDetails.email}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {studentDetails.phone}
                                  </div>
                                  <div className="text-[11px] font-medium mt-1">
                                    {lesson.startTime} - {lesson.endTime}
                                  </div>
                                  {lessonResult && !lessonResult.isSkippedLesson && (
                                    <div className="text-[10px] flex items-center gap-1">
                                      <span>שיעור #{lessonResult.lessonNumber}</span>
                                      {lessonResult.isBankTimeLesson && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                                          בנק זמן
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {lessonResult?.isSkippedLesson && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                      שיעור דולג
                                    </Badge>
                                  )}
                                  {isSwapped && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100">
                                      מוחלף
                                    </Badge>
                                  )}
                                  {lesson.isOneOff && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
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
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>🔄 <strong>שיעורים מוחלפים בכתום</strong> - שיעורים שהוחלפו בין תלמידות</p>
                  <p>🔵 <strong>שיעורים שהושלמו בכחול</strong> - שיעורים שכבר התקיימו</p>
                  <p>⚪ <strong>שיעורי עתיד באפור</strong> - שיעורים מתוכננים</p>
                  <p>💡 <strong>לחיצה כפולה על שיעור עתידי</strong> - לבקשת החלפה עם אימות קוד אישי</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Swap Request Dialog */}
          <StudentsSwapRequestDialog
            open={swapDialogOpen}
            onOpenChange={setSwapDialogOpen}
            selectedLesson={selectedLesson}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentsViewSystem;

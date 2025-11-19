import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { getLessons, getStudents } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import StudentSwapPanel from './lessonSwap/StudentSwapPanel';
import { Lesson } from '@/lib/types';

interface StudentWeeklyScheduleProps {
  studentId: string;
}

const StudentWeeklySchedule = ({ studentId }: StudentWeeklyScheduleProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [lessonSelectCallback, setLessonSelectCallback] = useState<((lesson: Lesson) => void) | null>(null);
  
  const allLessons = getLessons();
  const lessons = allLessons.filter(lesson => 
    lesson.studentId === studentId && 
    lesson.status !== 'no_show' // Hide no-show lessons from student view
  );
  const students = getStudents();
  const student = students.find(s => s.id === studentId);

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
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const getLessonsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    return lessons
      .filter(lesson => lesson.date === dateStr)
      .sort((a, b) => {
        // Show future lessons first, then completed
        if (a.date >= today && b.date < today) return -1;
        if (a.date < today && b.date >= today) return 1;
        return a.startTime.localeCompare(b.startTime);
      });
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

  const handleLessonClick = (lesson: Lesson) => {
    if (lessonSelectCallback) {
      lessonSelectCallback(lesson);
    }
  };

  const handleRegisterCallback = useCallback((callback: (lesson: Lesson) => void) => {
    setLessonSelectCallback(() => callback);
  }, []);

  const getStatusBadge = (status: string, isSwapped?: boolean) => {
    if (isSwapped) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">החלפה</Badge>;
    }

    const variants = {
      scheduled: 'secondary',
      completed: 'default',
      cancelled: 'destructive',
    } as const;

    const labels = {
      scheduled: 'מתוכנן',
      completed: 'הושלם',
      cancelled: 'בוטל',
    };

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  const isLessonSwapped = (lesson: Lesson): boolean => {
    // Check if this lesson was swapped by looking at all lessons
    // A lesson is considered swapped if there's evidence it was moved from another student
    return lesson.notes?.includes('הוחלף') || false;
  };

  if (!student) {
    return <div>תלמידה לא נמצאה</div>;
  }

  return (
    <>
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            המערכת השבועית שלי
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Week Navigation */}
          <div className="flex justify-between items-center mb-6">
            <Button onClick={handleNextWeek} variant="outline" size="sm">
              שבוע הבא
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
            <h3 className="text-lg font-semibold">
              {weekDates[0].toLocaleDateString('he-IL')} - {weekDates[6].toLocaleDateString('he-IL')}
            </h3>
            <Button onClick={handlePrevWeek} variant="outline" size="sm">
              <ArrowRight className="h-4 w-4" />
              שבוע קודם
            </Button>
          </div>

          {/* Weekly Schedule Table */}
          <div className="space-y-4">
            {weekDates.map((date, index) => {
              const dayLessons = getLessonsForDay(date);
              const today = new Date().toISOString().split('T')[0];
              const dateStr = date.toISOString().split('T')[0];
              const isToday = dateStr === today;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    isToday ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-lg">
                      {dayNames[index]} - {date.toLocaleDateString('he-IL')}
                      {isToday && <span className="mr-2 text-primary">(היום)</span>}
                    </h4>
                  </div>

                  {dayLessons.length > 0 ? (
                    <div className="space-y-2">
                      {dayLessons.map((lesson) => {
                        const isSwapped = isLessonSwapped(lesson);
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson)}
                            className="p-3 bg-muted/50 rounded-lg flex justify-between items-center hover:bg-muted cursor-pointer transition-colors"
                            title="לחץ לבחירת שיעור להחלפה"
                          >
                            <div className="flex items-center gap-4">
                              <span className="font-medium">
                                {lesson.startTime} - {lesson.endTime}
                              </span>
                              {lesson.notes && (
                                <span className="text-sm text-muted-foreground">{lesson.notes}</span>
                              )}
                            </div>
                            {getStatusBadge(lesson.status, isSwapped)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">אין שיעורים</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Student Info Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>תאריך התחלה:</strong> {new Date(student.startDate).toLocaleDateString('he-IL')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <StudentSwapPanel 
        studentId={studentId}
        onLessonClick={handleRegisterCallback}
      />
    </>
  );
};

export default StudentWeeklySchedule;

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { getLessons, getStudents, calculateLessonNumber } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { calculateEnhancedLessonNumber } from '@/lib/lessonNumbering';

interface StudentWeeklyScheduleProps {
  studentId: string;
}

const StudentWeeklySchedule = ({ studentId }: StudentWeeklyScheduleProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const lessons = getLessons().filter(lesson => lesson.studentId === studentId);
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
    return lessons.filter(lesson => lesson.date === dateStr);
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

  const getStatusBadge = (status: string) => {
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

  if (!student) {
    return <div>תלמידה לא נמצאה</div>;
  }

  return (
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

        {/* Weekly Schedule Table */}
        <div className="space-y-4">
          {weekDates.map((date, index) => {
            const dayLessons = getLessonsForDay(date);
            if (dayLessons.length === 0) return null;

            return (
              <div key={date.toISOString()} className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-lg">
                    {dayNames[index]} - {date.toLocaleDateString('he-IL')}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayLessons
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((lesson, lessonIndex) => {
                      const currentDate = new Date().toISOString().split('T')[0];
                      const isFuture = lesson.date > currentDate;
                      const isCompleted = lesson.status === 'completed';
                      
                      const lessonResult = calculateEnhancedLessonNumber(studentId, lesson.date, lesson.id);
                      
                      return (
                        <div
                          key={lesson.id}
                          className={`flex justify-between items-center p-3 border rounded-lg ${
                            isFuture 
                              ? 'bg-muted/50 text-muted-foreground border-muted/30' 
                              : isCompleted 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-primary/10 border-primary/20'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className={`font-medium flex items-center gap-2 ${isFuture ? 'text-muted-foreground' : isCompleted ? 'text-blue-800' : ''}`}>
                              {lessonResult.isSkippedLesson ? (
                                <Badge variant="secondary">שיעור דולג</Badge>
                              ) : (
                                <span>שיעור #{lessonResult.lessonNumber}</span>
                              )}
                              {lessonResult.isBankTimeLesson && (
                                <Badge variant="outline" className="text-xs">
                                  בנק זמן
                                </Badge>
                              )}
                            </div>
                            <div className={`text-sm ${isFuture ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                              {lesson.startTime} - {lesson.endTime}
                            </div>
                            {lesson.notes && (
                              <div className={`text-sm ${isFuture ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                {lesson.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            {getStatusBadge(lesson.status)}
                            {lesson.isOneOff && (
                              <Badge variant="outline" className="mr-2">
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

          {weekDates.every(date => getLessonsForDay(date).length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              אין שיעורים מתוכננים השבוע
            </div>
          )}
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
  );
};

export default StudentWeeklySchedule;

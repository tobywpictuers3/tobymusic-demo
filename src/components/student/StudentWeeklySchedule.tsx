import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowRight, ArrowLeft, MousePointer2 } from 'lucide-react';
import { getLessons, getStudents } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { Lesson } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface StudentWeeklyScheduleProps {
  studentId: string;
  onLessonDoubleClick?: (lesson: Lesson) => void;
}

const StudentWeeklySchedule = ({ studentId, onLessonDoubleClick }: StudentWeeklyScheduleProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
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


  const handleLessonDoubleClick = (lesson: Lesson) => {
    const today = new Date().toISOString().split('T')[0];
    
    if (lesson.date < today) {
      toast({
        title: 'שיעור בעבר',
        description: 'לא ניתן לבקש החלפה לשיעור שכבר עבר',
        variant: 'destructive',
      });
      return;
    }

    if (lesson.status !== 'scheduled') {
      toast({
        title: 'שיעור לא זמין',
        description: 'ניתן לבקש החלפה רק לשיעורים מתוכננים',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'שיעור נבחר ✓',
      description: `נבחר: ${new Date(lesson.date).toLocaleDateString('he-IL')} בשעה ${lesson.startTime}`,
    });

    if (onLessonDoubleClick) {
      onLessonDoubleClick(lesson);
    }
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
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MousePointer2 className="h-4 w-4" />
            לחצי לחיצה כפולה על שיעור כדי לבקש החלפה
          </p>
        </div>

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
            const today = new Date().toISOString().split('T')[0];
            const dateStr = date.toISOString().split('T')[0];
            const isFutureDay = dateStr >= today;

            if (dayLessons.length === 0) return null;

            return (
              <div key={date.toISOString()} className={`p-4 rounded-lg ${
                isFutureDay ? 'bg-primary/5 border-2 border-primary/20' : 'bg-secondary/30'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {dayNames[index]} - {date.toLocaleDateString('he-IL')}
                    {isFutureDay && (
                      <Badge variant="outline" className="text-xs">
                        קרוב
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayLessons.map((lesson) => {
                      const currentDate = new Date().toISOString().split('T')[0];
                      const isFuture = lesson.date >= currentDate;
                      const isCompleted = lesson.status === 'completed';
                      const isCancelled = lesson.status === 'cancelled';
                      
                      return (
                        <div
                          key={lesson.id}
                          className={`flex justify-between items-center p-3 border rounded-lg transition-all ${
                            isFuture && lesson.status === 'scheduled'
                              ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 shadow-sm cursor-pointer hover:border-primary' 
                              : isCompleted 
                                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                                : isCancelled
                                  ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                                  : 'bg-muted/50 border-muted'
                          }`}
                          onDoubleClick={() => handleLessonDoubleClick(lesson)}
                        >
                          <div className="space-y-1">
                            <div className={`font-medium ${isFuture ? 'text-primary' : ''}`}>
                              {lesson.startTime} - {lesson.endTime}
                            </div>
                            {lesson.notes && (
                              <div className="text-sm text-muted-foreground">
                                {lesson.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {lesson.isOneOff && (
                              <Badge variant="outline" className="text-xs">
                                חד פעמי
                              </Badge>
                            )}
                            {getStatusBadge(lesson.status)}
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

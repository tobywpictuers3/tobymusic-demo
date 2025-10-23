import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { getLessons } from '@/lib/storage';
import { Student, Lesson } from '@/lib/types';

interface LessonHistoryProps {
  student: Student;
}

interface LessonWithNumber extends Lesson {
  lessonNumber?: number;
}

const LessonHistory = ({ student }: LessonHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [allLessons, setAllLessons] = useState<LessonWithNumber[]>([]);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadLessons = () => {
      const currentDate = new Date().toISOString().split('T')[0];
      const actualLessons = getLessons();
      
      // Get all lessons for this student (including future)
      const studentLessons = actualLessons
        .filter(l => 
          l.studentId === student.id && 
          l.date >= student.startDate &&
          l.status !== 'cancelled' // Don't show cancelled lessons
        )
        .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
      
      // Calculate lesson numbers using the same logic as admin
      const lessonsWithNumbers = studentLessons.map(lesson => {
        if (lesson.status === 'completed') {
          const lessonNumber = calculateLessonNumber(lesson.date, lesson.id);
          return { ...lesson, lessonNumber };
        }
        return lesson;
      });
      
      setAllLessons(lessonsWithNumbers);
    };
    
    // This function matches exactly the admin's logic
    const calculateLessonNumber = (lessonDate: string, lessonId?: string): number => {
      const startDate = new Date(student.startDate);
      const checkDate = new Date(lessonDate);
      
      if (checkDate < startDate) return 0;

      const allLessons = getLessons();
      const completedLessons = allLessons
        .filter(l => l.studentId === student.id && l.status === 'completed' && new Date(l.date) <= checkDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (lessonId) {
        const index = completedLessons.findIndex(l => l.id === lessonId);
        return index >= 0 ? index + (student.startingLessonNumber || 1) : 0;
      }

      return completedLessons.length + (student.startingLessonNumber || 1);
    };
    
    loadLessons();
  }, [student]);

  const totalPages = Math.ceil(allLessons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLessons = allLessons.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: string) => {
    const variants = {
      scheduled: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    } as const;

    const labels = {
      scheduled: 'מתוכנן',
      completed: 'הושלם',
      cancelled: 'בוטל',
    };

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <History className="h-5 w-5" />
          היסטוריית שיעורים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allLessons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            לא נמצאו שיעורים עבור תלמידה זו
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              סך הכל {allLessons.length} שיעורים מתאריך ההתחלה
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר שיעור</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>שעה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLessons.map((lesson) => {
                  const currentDate = new Date().toISOString().split('T')[0];
                  const isFuture = lesson.date > currentDate;
                  const isCompleted = lesson.status === 'completed';
                  
                  return (
                    <TableRow key={lesson.id} className={isCompleted ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                      <TableCell className={`font-medium ${isFuture ? 'text-muted-foreground' : isCompleted ? 'text-blue-800 dark:text-blue-300' : ''}`}>
                        {lesson.lessonNumber ? `שיעור #${lesson.lessonNumber}` : '-'}
                      </TableCell>
                      <TableCell className={isFuture ? 'text-muted-foreground' : isCompleted ? 'text-blue-800 dark:text-blue-300' : ''}>
                        {new Date(lesson.date).toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell className={isFuture ? 'text-muted-foreground' : isCompleted ? 'text-blue-800 dark:text-blue-300' : ''}>
                        {lesson.startTime} - {lesson.endTime}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(lesson.status)}
                      </TableCell>
                      <TableCell className={isFuture ? 'text-muted-foreground' : isCompleted ? 'text-blue-800 dark:text-blue-300' : ''}>
                        {lesson.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  הקודם
                </Button>
                
                <span className="text-sm text-muted-foreground">
                  עמוד {currentPage} מתוך {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  הבא
                  <ChevronLeft className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LessonHistory;

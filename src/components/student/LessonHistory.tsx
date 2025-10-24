import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { getLessons } from '@/lib/storage';
import { Student, Lesson } from '@/lib/types';
import { calculateEnhancedLessonNumber } from '@/lib/lessonNumbering';

interface LessonHistoryProps {
  student: Student;
}

interface LessonWithNumber extends Lesson {
  lessonNumber?: number;
  isSkippedLesson?: boolean;
  isBankTimeLesson?: boolean;
}

const LessonHistory = ({ student }: LessonHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [allLessons, setAllLessons] = useState<LessonWithNumber[]>([]);
  const itemsPerPage = 10;

  useEffect(() => {
    const allStudentLessons = getLessons()
      .filter(lesson => lesson.studentId === student.id)
      .filter(lesson => lesson.status === 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const lessonsWithNumbers = allStudentLessons.map((lesson, index) => {
      return {
        ...lesson,
        lessonNumber: index + (student.startingLessonNumber || 1),
        isSkippedLesson: false,
        isBankTimeLesson: lesson.notes?.includes('בנק זמן') || false
      };
    });

    setAllLessons(lessonsWithNumbers.reverse());
    setCurrentPage(1);
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
                        {lesson.isSkippedLesson ? (
                          <Badge variant="secondary">שיעור דולג</Badge>
                        ) : lesson.lessonNumber ? (
                          <div className="flex items-center gap-2">
                            <span>שיעור #{lesson.lessonNumber}</span>
                            {lesson.isBankTimeLesson && (
                              <Badge variant="outline" className="text-xs">בנק זמן</Badge>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
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

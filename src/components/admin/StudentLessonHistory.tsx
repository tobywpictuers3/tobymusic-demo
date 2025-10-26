import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { getLessons, updateLesson } from '@/lib/storage';
import { Student, Lesson } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface StudentLessonHistoryProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StudentLessonHistory = ({ student, open, onOpenChange }: StudentLessonHistoryProps) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [gradingLesson, setGradingLesson] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const studentLessons = getLessons()
        .filter(lesson => lesson.studentId === student.id)
        .filter(lesson => lesson.status === 'completed')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setLessons(studentLessons);
    }
  }, [student.id, open]);

  const handleGrade = (lessonId: string, grade: number) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
      updateLesson(lessonId, { ...lesson, grade });
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, grade } : l));
      setGradingLesson(null);
      toast({
        title: 'הצלחה',
        description: `ציון ${grade}/5 נשמר בהצלחה`
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>היסטוריית שיעורים - {student.firstName} {student.lastName}</DialogTitle>
        </DialogHeader>
        
        {lessons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            לא נמצאו שיעורים שהושלמו
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>שעה</TableHead>
                <TableHead>ציון ש"ב</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((lesson, index) => (
                <TableRow key={lesson.id}>
                  <TableCell>{new Date(lesson.date).toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>{lesson.startTime} - {lesson.endTime}</TableCell>
                  <TableCell>
                    {gradingLesson === lesson.id ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(grade => (
                          <Button
                            key={grade}
                            size="sm"
                            variant={lesson.grade === grade ? 'default' : 'outline'}
                            onClick={() => handleGrade(lesson.id, grade)}
                            className="w-8 h-8 p-0"
                          >
                            {grade}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setGradingLesson(null)}
                        >
                          ביטול
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {lesson.grade ? (
                          <Badge variant="secondary" className="text-sm">
                            {lesson.grade}/5
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setGradingLesson(lesson.id)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{lesson.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentLessonHistory;

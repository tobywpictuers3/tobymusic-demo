import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Student, Lesson } from '@/lib/types';
import { SwapRequest } from '@/lib/lessonSwap/types';
import { isFutureLesson, validateSwap, applySwap } from '@/lib/lessonSwap/logic';
import { addSwapRequest, markLessonsAsSwapped } from '@/lib/lessonSwap/store';
import { getLessons, getStudents, updateLesson } from '@/lib/storage';
import { addMessage } from '@/lib/messages';
import { ArrowLeftRight, X, MousePointerClick } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface StudentSwapPanelProps {
  student: Student;
  lessons: Lesson[];
  onMount?: (ref: { handleLessonDoubleClick: (lesson: Lesson) => void }) => void;
}

export interface StudentSwapPanelRef {
  handleLessonDoubleClick: (lesson: Lesson) => void;
}

const StudentSwapPanel = forwardRef<StudentSwapPanelRef, StudentSwapPanelProps>(
  ({ student, lessons, onMount }, ref) => {
    const [myLessonId, setMyLessonId] = useState<string>('');
    const [mySwapCode, setMySwapCode] = useState<string>('');
    const [targetLessonId, setTargetLessonId] = useState<string>('');
    const [targetSwapCode, setTargetSwapCode] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectionMode, setSelectionMode] = useState<'my' | 'target' | null>(null);

    const myFutureLessons = lessons.filter(
      (lesson) => lesson.studentId === student.id && isFutureLesson(lesson)
    );

    const allFutureLessons = getLessons().filter(isFutureLesson);

    const availableTargetLessons = allFutureLessons.filter(
      (lesson) => lesson.id !== myLessonId
    );

    const isMyCodeValid = mySwapCode === student.swapCode;

    const mySelectedLesson = myLessonId ? lessons.find(l => l.id === myLessonId) : null;
    const targetSelectedLesson = targetLessonId ? getLessons().find(l => l.id === targetLessonId) : null;

    // Handle lesson double-click from weekly schedule
    const handleLessonDoubleClick = (lesson: Lesson) => {
      if (selectionMode === 'my') {
        if (lesson.studentId === student.id && isFutureLesson(lesson)) {
          setMyLessonId(lesson.id);
          setSelectionMode(null);
          toast({ description: 'שיעור נבחר בהצלחה ✓' });
        } else {
          toast({ 
            description: 'לא ניתן לבחור שיעור זה', 
            variant: 'destructive' 
          });
        }
      } else if (selectionMode === 'target') {
        if (isFutureLesson(lesson) && lesson.id !== myLessonId) {
          setTargetLessonId(lesson.id);
          setSelectionMode(null);
          toast({ description: 'שיעור יעד נבחר בהצלחה ✓' });
        } else {
          toast({ 
            description: 'לא ניתן לבחור שיעור זה', 
            variant: 'destructive' 
          });
        }
      }
    };

    // Expose the handler to parent via ref
    useImperativeHandle(ref, () => ({
      handleLessonDoubleClick
    }));

    // Call onMount when component mounts
    useEffect(() => {
      if (onMount) {
        onMount({ handleLessonDoubleClick });
      }
    }, []);

    const handleSubmit = async () => {
      if (!myLessonId || !targetLessonId) {
        toast({
          title: 'שגיאה',
          description: 'יש לבחור שני שיעורים להחלפה',
          variant: 'destructive',
        });
        return;
      }

      if (!isMyCodeValid) {
        toast({
          title: 'שגיאה',
          description: 'קוד ההחלפה שלך שגוי',
          variant: 'destructive',
        });
        return;
      }

      setIsProcessing(true);

      try {
        const allLessons = getLessons();
        const allStudents = getStudents();
        const myLesson = allLessons.find(l => l.id === myLessonId);
        const targetLesson = allLessons.find(l => l.id === targetLessonId);

        if (!myLesson || !targetLesson) {
          throw new Error('שיעורים לא נמצאו');
        }

        const targetStudent = allStudents.find(s => s.id === targetLesson.studentId);

        if (!targetStudent) {
          throw new Error('תלמידת יעד לא נמצאה');
        }

        // Create swap request object
        const swapRequest: Omit<SwapRequest, 'id'> = {
          requesterStudentId: student.id,
          requesterLessonId: myLessonId,
          targetStudentId: targetStudent.id,
          targetLessonId: targetLessonId,
          requesterSwapCode: mySwapCode,
          targetSwapCode: targetSwapCode || undefined,
          status: 'pending_manager',
          createdAt: new Date().toISOString(),
        };

        // Validate the swap
        const validation = validateSwap(swapRequest as SwapRequest, allLessons, allStudents);
        if (!validation.ok) {
          toast({
            title: 'שגיאה',
            description: validation.error,
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }

        // Apply the swap logic
        const result = applySwap(
          swapRequest as SwapRequest,
          allLessons,
          allStudents,
          (req) => markLessonsAsSwapped(req, getLessons, updateLesson)
        );

        if (!result.ok) {
          toast({
            title: 'שגיאה',
            description: result.error || 'שגיאה בביצוע ההחלפה',
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }

        // Save the swap request with the final status
        const finalRequest = addSwapRequest({
          ...swapRequest,
          status: result.status || 'pending_manager',
          resolvedAt: result.status === 'auto_approved' ? new Date().toISOString() : undefined,
        });

        // Format lesson details for messages
        const myLessonDetails = `${format(new Date(myLesson.date), 'dd/MM/yyyy', { locale: he })} בשעה ${myLesson.startTime}`;
        const targetLessonDetails = `${format(new Date(targetLesson.date), 'dd/MM/yyyy', { locale: he })} בשעה ${targetLesson.startTime}`;

        if (result.status === 'auto_approved') {
          // Send success messages to admin and both students
          addMessage({
            senderId: 'system',
            senderName: 'מערכת',
            recipientIds: ['admin', student.id, targetStudent.id],
            subject: 'החלפת שיעור בוצעה בהצלחה',
            content: `החלפת שיעור בין ${student.firstName} ${student.lastName} ל-${targetStudent.firstName} ${targetStudent.lastName} בוצעה בהצלחה.\n\nשיעור של ${student.firstName}: ${myLessonDetails}\nשיעור של ${targetStudent.firstName}: ${targetLessonDetails}\n\nההחלפה אושרה אוטומטית באמצעות קוד החלפה.`,
            type: 'swap_approval',
          });

          toast({
            title: 'הצלחה!',
            description: 'ההחלפה בוצעה בהצלחה באמצעות קוד החלפה',
          });
        } else {
          // Send pending request message to admin only
          addMessage({
            senderId: student.id,
            senderName: `${student.firstName} ${student.lastName}`,
            recipientIds: ['admin'],
            subject: 'בקשת החלפת שיעור',
            content: `בקשה חדשה להחלפת שיעור:\n\nמבקשת: ${student.firstName} ${student.lastName}\nשיעור מבוקש להחלפה: ${myLessonDetails}\n\nתלמידת יעד: ${targetStudent.firstName} ${targetStudent.lastName}\nשיעור מבוקש: ${targetLessonDetails}\n\n${targetSwapCode ? 'קוד החלפה של היעד הוזן אך אינו תקין' : 'לא הוזן קוד החלפה - נדרש אישור ידני'}`,
            type: 'swap_request',
          });

          toast({
            title: 'הבקשה נשלחה',
            description: 'הבקשה נשלחה למנהלת לאישור',
          });
        }

        // Reset form
        setMyLessonId('');
        setMySwapCode('');
        setTargetLessonId('');
        setTargetSwapCode('');
      } catch (error) {
        console.error('Error processing swap:', error);
        toast({
          title: 'שגיאה',
          description: error instanceof Error ? error.message : 'שגיאה בביצוע ההחלפה',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    };

    const formatLessonDisplay = (lesson: Lesson | null) => {
      if (!lesson) return null;

      const students = getStudents();
      const lessonStudent = students.find((s) => s.id === lesson.studentId);
      const studentName = lessonStudent
        ? `${lessonStudent.firstName} ${lessonStudent.lastName}`
        : 'לא ידוע';

      return (
        <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="font-semibold text-primary">
                {lesson.date} | {lesson.startTime}-{lesson.endTime}
              </div>
              <div className="text-sm text-muted-foreground">
                {studentName}
              </div>
              {lesson.notes && (
                <div className="text-xs text-muted-foreground">
                  {lesson.notes}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (lesson.id === myLessonId) setMyLessonId('');
                if (lesson.id === targetLessonId) setTargetLessonId('');
              }}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    };

    return (
      <>
        {/* Selection Mode Banner */}
        {selectionMode && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <Badge className="text-lg px-6 py-3 bg-primary text-primary-foreground shadow-lg animate-pulse">
              <MousePointerClick className="h-5 w-5 ml-2" />
              לחצי לחיצה כפולה על שיעור מהמערכת למעלה
            </Badge>
          </div>
        )}

        <Card className="card-gradient card-shadow mt-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              החלפת שיעורים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {/* My Lesson Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">השיעור שלי להחלפה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>בחרי שיעור</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-right h-auto py-3"
                      onClick={() => setSelectionMode('my')}
                      disabled={selectionMode !== null}
                    >
                      <MousePointerClick className="h-4 w-4 ml-2" />
                      {mySelectedLesson ? 'שיעור נבחר - לחצי לשינוי' : 'לחצי כאן ובחרי שיעור מהמערכת'}
                    </Button>
                    {formatLessonDisplay(mySelectedLesson)}
                  </div>

                  <div>
                    <Label>קוד ההחלפה שלי</Label>
                    <Input
                      type="password"
                      placeholder="הזיני קוד החלפה (4 ספרות)"
                      value={mySwapCode}
                      onChange={(e) => setMySwapCode(e.target.value)}
                      maxLength={4}
                    />
                    {mySwapCode && !isMyCodeValid && (
                      <p className="text-sm text-destructive mt-1">קוד שגוי</p>
                    )}
                    {mySwapCode && isMyCodeValid && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        קוד נכון ✓
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Target Lesson Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">השיעור שאני רוצה לקבל</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>בחרי שיעור מבוקש</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-right h-auto py-3"
                      onClick={() => setSelectionMode('target')}
                      disabled={!myLessonId || !isMyCodeValid || selectionMode !== null}
                    >
                      <MousePointerClick className="h-4 w-4 ml-2" />
                      {targetSelectedLesson ? 'שיעור נבחר - לחצי לשינוי' : 'לחצי כאן ובחרי שיעור מהמערכת'}
                    </Button>
                    {formatLessonDisplay(targetSelectedLesson)}
                  </div>

                  <div>
                    <Label>קוד החלפה של התלמידה השנייה (אופציונלי)</Label>
                    <Input
                      type="password"
                      placeholder="לאישור אוטומטי - הזיני קוד"
                      value={targetSwapCode}
                      onChange={(e) => setTargetSwapCode(e.target.value)}
                      maxLength={4}
                      disabled={!targetLessonId}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      אם תזיני קוד נכון, ההחלפה תתבצע אוטומטית
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleSubmit}
                disabled={!myLessonId || !targetLessonId || !isMyCodeValid || isProcessing}
                size="lg"
                className="w-full md:w-auto"
              >
                {isProcessing ? 'מעבד...' : 'שלחי בקשת החלפה'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }
);

StudentSwapPanel.displayName = 'StudentSwapPanel';

export default StudentSwapPanel;

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
import { addSwapRequest, markLessonsAsSwapped } from '@/lib/lessonSwap/swapStore';
import { getLessons, getStudents, updateLesson } from '@/lib/storage';
import { addMessage } from '@/lib/messages';
import { ArrowLeftRight, X, MousePointerClick } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

    // Handle lesson click from weekly schedule - EXPLICIT selectionMode
    const handleLessonDoubleClick = (lesson: Lesson) => {
      console.log('🔄 handleLessonDoubleClick called', { 
        lessonId: lesson.id, 
        selectionMode, 
        myLessonId, 
        targetLessonId 
      });

      // Validate future lesson
      if (!isFutureLesson(lesson)) {
        toast({ 
          description: 'ניתן לבחור רק שיעורים עתידיים', 
          variant: 'destructive' 
        });
        return;
      }

      // Handle based on EXPLICIT selectionMode
      if (selectionMode === 'my') {
        console.log('✅ Selecting MY lesson');
        // Validate it's the student's lesson
        if (lesson.studentId === student.id) {
          setMyLessonId(lesson.id);
          setSelectionMode(null);
          toast({ description: '✓ השיעור שלי נבחר בהצלחה' });
        } else {
          toast({ 
            description: 'זה לא השיעור שלך', 
            variant: 'destructive' 
          });
        }
      } else if (selectionMode === 'target') {
        console.log('✅ Selecting TARGET lesson');
        // Validate it's not the same lesson
        if (lesson.id !== myLessonId && isFutureLesson(lesson)) {
          setTargetLessonId(lesson.id);
          setSelectionMode(null);
          toast({ description: '✓ השיעור המבוקש נבחר בהצלחה' });
        } else {
          toast({ 
            description: 'לא ניתן לבחור שיעור זה', 
            variant: 'destructive' 
          });
        }
      } else {
        console.log('❌ No selectionMode active');
        // No selection mode active
        toast({ 
          description: 'לחצי קודם על "בחרי שיעור" או "בחרי שיעור מבוקש"', 
          variant: 'destructive' 
        });
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

    const handleSubmitClick = () => {
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

      // Show confirmation dialog before proceeding
      setShowConfirmDialog(true);
    };

    const handleConfirmedSubmit = async () => {
      setShowConfirmDialog(false);
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
          // Send success messages to admin and both students with starred flag
          addMessage({
            senderId: 'system',
            senderName: 'מערכת',
            recipientIds: ['admin', student.id, targetStudent.id],
            subject: '⭐ ✓ החלפת שיעור בוצעה',
            content: `✅ החלפת שיעור בוצעה בהצלחה!\n\n👥 בין: ${student.firstName} ${student.lastName} ↔ ${targetStudent.firstName} ${targetStudent.lastName}\n\n📅 שיעור של ${student.firstName}: ${myLessonDetails}\n📅 שיעור של ${targetStudent.firstName}: ${targetLessonDetails}\n\n✨ ההחלפה אושרה אוטומטית באמצעות קוד החלפה תקין.\nהשיעורים עודכנו במערכת.`,
            type: 'swap_approval',
            starred: { [student.id]: true, [targetStudent.id]: true, 'admin': true },
          });

          toast({
            title: 'הצלחה!',
            description: 'ההחלפה בוצעה בהצלחה באמצעות קוד החלפה',
          });
        } else {
          // Send pending request message to admin only with starred flag
          addMessage({
            senderId: student.id,
            senderName: `${student.firstName} ${student.lastName}`,
            recipientIds: ['admin'],
            subject: '⭐ בקשת החלפת שיעור - דורש אישור',
            content: `📋 בקשה חדשה להחלפת שיעור\n\n👤 מבקשת: ${student.firstName} ${student.lastName}\n📅 שיעור להחלפה: ${myLessonDetails}\n\n👤 תלמידת יעד: ${targetStudent.firstName} ${targetStudent.lastName}\n📅 שיעור מבוקש: ${targetLessonDetails}\n\n${targetSwapCode ? '⚠️ קוד החלפה של היעד הוזן אך אינו תקין - נדרש אישור ידני' : '⏳ לא הוזן קוד החלפה - נדרש אישור ידני'}\n\nלאישור או דחייה, עברי ללשונית 'תקשורת' > 'בקשות החלפה'`,
            type: 'swap_request',
            starred: { 'admin': true },
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
        <div className="mt-2 p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <div className="font-semibold text-green-700 dark:text-green-400">
                  {lesson.date} | {lesson.startTime}-{lesson.endTime}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mr-8">
                {studentName}
              </div>
              {lesson.notes && (
                <div className="text-xs text-muted-foreground mr-8">
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
              לחצי על שיעור מהמערכת למעלה
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
                      variant={selectionMode === 'my' ? 'default' : 'outline'}
                      className={`w-full justify-start text-right h-auto py-3 ${
                        selectionMode === 'my' ? 'bg-primary text-primary-foreground animate-pulse' : ''
                      }`}
                      onClick={() => {
                        console.log('🔘 Button clicked - setting selectionMode to MY');
                        setSelectionMode('my');
                        toast({ 
                          description: '👆 עכשיו לחצי על שיעור שלך במערכת למעלה',
                          duration: 3000
                        });
                      }}
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
                      variant={selectionMode === 'target' ? 'default' : 'outline'}
                      className={`w-full justify-start text-right h-auto py-3 ${
                        selectionMode === 'target' ? 'bg-primary text-primary-foreground animate-pulse' : ''
                      }`}
                      onClick={() => {
                        console.log('🔘 Button clicked - setting selectionMode to TARGET');
                        setSelectionMode('target');
                        toast({ 
                          description: '👆 עכשיו לחצי על השיעור המבוקש במערכת למעלה',
                          duration: 3000
                        });
                      }}
                      disabled={!myLessonId || !isMyCodeValid}
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
                onClick={handleSubmitClick}
                disabled={!myLessonId || !targetLessonId || !isMyCodeValid || isProcessing}
                size="lg"
                className="w-full md:w-auto"
              >
                {isProcessing ? 'מעבד...' : 'שלחי בקשת החלפה'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>אישור החלפת שיעור</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 text-right">
                  <p className="font-semibold text-foreground">הינך מעוניינת להחליף:</p>
                  
                  {mySelectedLesson && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="font-semibold text-primary">📅 השיעור שלך:</p>
                      <p className="text-sm">
                        {format(new Date(mySelectedLesson.date), 'dd/MM/yyyy', { locale: he })} 
                        {' '}בשעה{' '}
                        {mySelectedLesson.startTime}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <ArrowLeftRight className="h-6 w-6 text-primary" />
                  </div>

                  {targetSelectedLesson && (
                    <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                      <p className="font-semibold text-secondary-foreground">📅 השיעור המבוקש:</p>
                      <p className="text-sm">
                        {format(new Date(targetSelectedLesson.date), 'dd/MM/yyyy', { locale: he })}
                        {' '}בשעה{' '}
                        {targetSelectedLesson.startTime}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const targetStudent = getStudents().find(s => s.id === targetSelectedLesson.studentId);
                          return targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : '';
                        })()}
                      </p>
                    </div>
                  )}

                  <p className="font-semibold text-foreground pt-2">האם את בטוחה?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogAction onClick={handleConfirmedSubmit}>
                אישור
              </AlertDialogAction>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

StudentSwapPanel.displayName = 'StudentSwapPanel';

export default StudentSwapPanel;

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
  onStepChange?: (step: 1 | 2 | 3 | 4) => void;
}

export interface StudentSwapPanelRef {
  handleLessonDoubleClick: (lesson: Lesson) => void;
}

const StudentSwapPanel = forwardRef<StudentSwapPanelRef, StudentSwapPanelProps>(
  ({ student, lessons, onMount, onStepChange }, ref) => {
    // Step-based state management
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
    const [myLessonId, setMyLessonId] = useState<string>('');
    const [mySwapCode, setMySwapCode] = useState<string>('');
    const [targetLessonId, setTargetLessonId] = useState<string>('');
    const [targetSwapCode, setTargetSwapCode] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
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

    // Auto-advance steps
    useEffect(() => {
      if (currentStep === 1 && isMyCodeValid) {
        setCurrentStep(2);
      }
    }, [mySwapCode, isMyCodeValid, currentStep]);

    useEffect(() => {
      if (currentStep === 2 && myLessonId) {
        setCurrentStep(3);
      }
    }, [myLessonId, currentStep]);

    useEffect(() => {
      if (currentStep === 3 && targetLessonId) {
        setCurrentStep(4);
      }
    }, [targetLessonId, currentStep]);

    // Handle lesson click from weekly schedule - auto-detect based on currentStep
    const handleLessonDoubleClick = (lesson: Lesson) => {
      console.log('🔍 handleLessonDoubleClick called', { 
        lessonId: lesson.id, 
        lessonStudentId: lesson.studentId,
        currentStudentId: student.id,
        currentStep, 
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

      // Auto-detect what to select based on currentStep
      if (currentStep === 2) {
        console.log('📍 Step 2: Selecting MY lesson');
        // Step 2: Select MY lesson
        if (lesson.studentId === student.id) {
          setMyLessonId(lesson.id);
          console.log('✅ MY lesson selected:', lesson.id);
          toast({ description: '✓ השיעור שלי נבחר בהצלחה' });
        } else {
          console.log('❌ Not student lesson:', lesson.studentId, 'vs', student.id);
          toast({ 
            description: 'זה לא השיעור שלך - בחרי שיעור שרשום על שמך', 
            variant: 'destructive' 
          });
        }
      } else if (currentStep === 3) {
        console.log('📍 Step 3: Selecting TARGET lesson');
        // Step 3: Select TARGET lesson
        if (lesson.id !== myLessonId && isFutureLesson(lesson)) {
          setTargetLessonId(lesson.id);
          console.log('✅ TARGET lesson selected:', lesson.id);
          toast({ description: '✓ השיעור המבוקש נבחר בהצלחה' });
        } else {
          console.log('❌ Cannot select:', { isSameAsMyLesson: lesson.id === myLessonId, isFuture: isFutureLesson(lesson) });
          toast({ 
            description: 'לא ניתן לבחור שיעור זה', 
            variant: 'destructive' 
          });
        }
      } else {
        console.log('❌ Not in selection step, currentStep:', currentStep);
        // Not in selection mode
        toast({ 
          description: 'השלימי את השלבים הקודמים', 
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

    // Notify parent of step changes
    useEffect(() => {
      console.log('[StudentSwapPanel] Step changed to:', currentStep);
      if (onStepChange) {
        onStepChange(currentStep);
      }
    }, [currentStep, onStepChange]);

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
        setCurrentStep(1);
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
        <Card className="card-gradient card-shadow mt-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              החלפת שיעורים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Step 1: Code Entry */}
              <Card className={currentStep === 1 ? 'border-2 border-primary' : 'opacity-60'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant={currentStep > 1 ? 'default' : 'outline'}>
                      {currentStep > 1 ? '✓' : '1'}
                    </Badge>
                    הזיני קוד החלפה
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label>קוד ההחלפה שלי</Label>
                    <Input
                      type="password"
                      placeholder="הזיני קוד החלפה (4 ספרות)"
                      value={mySwapCode}
                      onChange={(e) => setMySwapCode(e.target.value)}
                      maxLength={4}
                      disabled={currentStep > 1}
                    />
                    {mySwapCode && !isMyCodeValid && (
                      <p className="text-sm text-destructive mt-1">קוד שגוי</p>
                    )}
                    {mySwapCode && isMyCodeValid && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        קוד נכון ✓ - עברי לשלב הבא
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: My Lesson Selection */}
              <Card className={currentStep === 2 ? 'border-2 border-primary' : 'opacity-60'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant={currentStep > 2 ? 'default' : currentStep === 2 ? 'outline' : 'secondary'}>
                      {currentStep > 2 ? '✓' : '2'}
                    </Badge>
                    בחרי את השיעור שלך להחלפה
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentStep === 2 && !myLessonId && (
                    <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
                      <p className="text-center font-semibold">
                        👆 לחצי על השיעור שלך במערכת השעות למעלה
                      </p>
                    </div>
                  )}
                  {formatLessonDisplay(mySelectedLesson)}
                </CardContent>
              </Card>

              {/* Step 3: Target Lesson Selection */}
              <Card className={currentStep === 3 ? 'border-2 border-primary' : 'opacity-60'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant={currentStep > 3 ? 'default' : currentStep === 3 ? 'outline' : 'secondary'}>
                      {currentStep > 3 ? '✓' : '3'}
                    </Badge>
                    בחרי את השיעור המבוקש
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentStep === 3 && !targetLessonId && (
                    <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
                      <p className="text-center font-semibold">
                        👆 לחצי על השיעור המבוקש במערכת השעות למעלה
                      </p>
                    </div>
                  )}
                  {formatLessonDisplay(targetSelectedLesson)}
                </CardContent>
              </Card>

              {/* Step 4: Optional Target Code + Submit */}
              <Card className={currentStep === 4 ? 'border-2 border-primary' : 'opacity-60'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant={currentStep === 4 ? 'outline' : 'secondary'}>4</Badge>
                    קוד החלפה של התלמידה השנייה (אופציונלי)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>קוד החלפה של התלמידה השנייה</Label>
                    <Input
                      type="password"
                      placeholder="לאישור אוטומטי - הזיני קוד"
                      value={targetSwapCode}
                      onChange={(e) => setTargetSwapCode(e.target.value)}
                      maxLength={4}
                      disabled={currentStep < 4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      הזיני קוד רק אם יש לך את הקוד של התלמידה השנייה - אחרת הבקשה תישלח למנהלת לאישור
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitClick}
                    disabled={!myLessonId || !targetLessonId || !isMyCodeValid || isProcessing || currentStep < 4}
                    className="w-full mt-4"
                    size="lg"
                  >
                    {isProcessing ? 'מעבד...' : 'אשר והגש בקשה'}
                  </Button>
                </CardContent>
              </Card>
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

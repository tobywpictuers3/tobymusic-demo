import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Student, Lesson } from '@/lib/types';
import { SwapRequest } from '@/lib/lessonSwap/types';
import { isFutureLesson, validateSwap, applySwap } from '@/lib/lessonSwap/logic';
import { addSwapRequest, markLessonsAsSwapped } from '@/lib/lessonSwap/store';
import { addMessage } from '@/lib/messages';
import { getLessons, updateLesson, getStudents } from '@/lib/storage';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ArrowRightLeft, Calendar, Clock } from 'lucide-react';

interface StudentSwapPanelProps {
  student: Student;
  lessons: Lesson[];
}

const StudentSwapPanel = ({ student, lessons }: StudentSwapPanelProps) => {
  const [myLessonId, setMyLessonId] = useState<string>('');
  const [mySwapCode, setMySwapCode] = useState<string>('');
  const [targetLessonId, setTargetLessonId] = useState<string>('');
  const [targetSwapCode, setTargetSwapCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get only future lessons for this student
  const myFutureLessons = lessons.filter(l => 
    l.studentId === student.id && isFutureLesson(l)
  );

  // Get all future lessons from all students
  const allLessons = getLessons();
  const allStudents = getStudents();
  const allFutureLessons = allLessons.filter(l => isFutureLesson(l));

  // Filter out the selected "my lesson" from target options
  const availableTargetLessons = allFutureLessons.filter(l => l.id !== myLessonId);

  // Validate my swap code
  const isMyCodeValid = mySwapCode === student.swapCode;

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

  const formatLessonDisplay = (lesson: Lesson) => {
    const lessonStudent = allStudents.find(s => s.id === lesson.studentId);
    const date = format(new Date(lesson.date), 'dd/MM/yyyy (EEEE)', { locale: he });
    return `${lessonStudent ? `${lessonStudent.firstName} ${lessonStudent.lastName} - ` : ''}${date} ${lesson.startTime}`;
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-6">
        <ArrowRightLeft className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">החלפת שיעור</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Box 1: My Lesson */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              השיעור שלי להחלפה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="my-lesson">בחרי שיעור</Label>
              <Select value={myLessonId} onValueChange={setMyLessonId}>
                <SelectTrigger id="my-lesson">
                  <SelectValue placeholder="בחרי שיעור להחלפה" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {myFutureLessons.length === 0 ? (
                    <SelectItem value="none" disabled>אין שיעורים עתידיים</SelectItem>
                  ) : (
                    myFutureLessons.map((lesson) => (
                      <SelectItem key={lesson.id} value={lesson.id}>
                        {formatLessonDisplay(lesson)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="my-code">קוד החלפה שלך</Label>
              <Input
                id="my-code"
                type="password"
                placeholder="הזיני את קוד ההחלפה שלך"
                value={mySwapCode}
                onChange={(e) => setMySwapCode(e.target.value)}
                maxLength={4}
                className={mySwapCode && !isMyCodeValid ? 'border-destructive' : ''}
              />
              {mySwapCode && !isMyCodeValid && (
                <p className="text-sm text-destructive">קוד שגוי</p>
              )}
              <p className="text-xs text-muted-foreground">
                את יכולה למצוא את קוד ההחלפה שלך בלשונית "פרטי התלמידה"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Box 2: Target Lesson */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              השיעור שאני רוצה לקבל
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-lesson">בחרי שיעור</Label>
              <Select 
                value={targetLessonId} 
                onValueChange={setTargetLessonId}
                disabled={!myLessonId || !isMyCodeValid}
              >
                <SelectTrigger id="target-lesson">
                  <SelectValue placeholder="בחרי שיעור מבוקש" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableTargetLessons.length === 0 ? (
                    <SelectItem value="none" disabled>אין שיעורים זמינים</SelectItem>
                  ) : (
                    availableTargetLessons.map((lesson) => (
                      <SelectItem key={lesson.id} value={lesson.id}>
                        {formatLessonDisplay(lesson)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-code">קוד החלפה של התלמידה (אופציונלי)</Label>
              <Input
                id="target-code"
                type="password"
                placeholder="לאישור אוטומטי - הזיני קוד"
                value={targetSwapCode}
                onChange={(e) => setTargetSwapCode(e.target.value)}
                maxLength={4}
                disabled={!myLessonId || !isMyCodeValid}
              />
              <p className="text-xs text-muted-foreground">
                אם את מכירה את קוד ההחלפה של התלמידה השנייה, ההחלפה תאושר אוטומטית
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
    </div>
  );
};

export default StudentSwapPanel;

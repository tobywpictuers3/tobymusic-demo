
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, MousePointer2, CheckCircle } from 'lucide-react';
import { getStudents, getLessons, addSwapRequest } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { addMessage } from '@/lib/messages';
import { Lesson } from '@/lib/types';

interface SwapRequestFormProps {
  studentId: string;
  prefilledLesson?: Lesson;
}

const SwapRequestForm = ({ studentId, prefilledLesson }: SwapRequestFormProps) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [swapCode, setSwapCode] = useState('');
  const [reason, setReason] = useState('');
  
  const students = getStudents().filter(s => s.id !== studentId);
  const lessons = getLessons().filter(l => l.studentId === studentId);
  
  // Get upcoming lessons for the current student
  const today = new Date().toISOString().split('T')[0];
  const upcomingLessons = lessons.filter(l => l.date >= today && l.status === 'scheduled');

  // Prefill if lesson was selected by double-click
  useEffect(() => {
    if (prefilledLesson) {
      setSelectedDate(prefilledLesson.date);
      setSelectedTime(prefilledLesson.startTime);
    }
  }, [prefilledLesson]);

  const handleSubmitRequest = () => {
    if (!selectedDate || !targetStudentId || !reason.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    // Get the lesson time from the selected lesson or use manual input
    let lessonTime = selectedTime;
    if (!lessonTime) {
      const selectedLesson = upcomingLessons.find(l => l.date === selectedDate);
      if (selectedLesson) {
        lessonTime = selectedLesson.startTime;
      } else {
        toast({
          title: 'שגיאה',
          description: 'נא לבחור שיעור או להזין שעה ידנית',
          variant: 'destructive',
        });
        return;
      }
    }

    const targetStudent = students.find(s => s.id === targetStudentId);
    
    // Check if swap code is correct for auto-approval
    const isAutoApproved = swapCode.trim() && targetStudent?.swapCode === swapCode.trim();

    if (isAutoApproved) {
      // Auto-approve the swap
      addSwapRequest({
        requesterId: studentId,
        targetId: targetStudentId,
        date: selectedDate,
        time: lessonTime,
        reason: reason.trim(),
        status: 'approved',
        createdAt: new Date().toISOString(),
      });

      // Send notification message to admin
      const allStudents = getStudents();
      const requester = allStudents.find(s => s.id === studentId);
      
      if (requester && targetStudent) {
        const messageContent = `החלפת שיעור אושרה אוטומטית\n\nמבקש: ${requester.firstName} ${requester.lastName}\nשיעור מקורי: ${selectedDate} בשעה ${lessonTime}\n\nהוחלף עם: ${targetStudent.firstName} ${targetStudent.lastName}\n\nסיבה: ${reason.trim()}\n\nההחלפה אושרה אוטומטית בקוד החלפה.`;
        
        addMessage({
          senderId: studentId,
          senderName: `${requester.firstName} ${requester.lastName}`,
          recipientIds: ['admin'],
          subject: 'החלפת שיעור אושרה אוטומטית',
          content: messageContent,
          type: 'swap_request',
        });
      }

      toast({
        title: 'ההחלפה אושרה! ✅',
        description: 'ההחלפה בוצעה בהצלחה עם קוד החלפה',
      });
    } else {
      // Regular swap request - needs admin approval
      addSwapRequest({
        requesterId: studentId,
        targetId: targetStudentId,
        date: selectedDate,
        time: lessonTime,
        reason: reason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Send swap request message to admin
      const allStudents = getStudents();
      const requester = allStudents.find(s => s.id === studentId);

      if (requester && targetStudent) {
        const messageContent = `בקשת החלפת שיעור חדשה\n\nמבקש: ${requester.firstName} ${requester.lastName}\nשיעור מקורי: ${selectedDate} בשעה ${lessonTime}\n\nמבוקש להחליף עם: ${targetStudent.firstName} ${targetStudent.lastName}\n\nסיבה: ${reason.trim()}`;
        
        addMessage({
          senderId: studentId,
          senderName: `${requester.firstName} ${requester.lastName}`,
          recipientIds: ['admin'],
          subject: 'בקשת החלפת שיעור',
          content: messageContent,
          type: 'swap_request',
        });
      }

      toast({
        title: 'הבקשה נשלחה בהצלחה',
        description: 'הבקשה נשלחה למנהלת לאישור',
      });
    }

    // Reset form
    setSelectedDate('');
    setSelectedTime('');
    setTargetStudentId('');
    setSwapCode('');
    setReason('');
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : '';
  };

  const formatLessonOption = (lesson: any) => {
    const date = new Date(lesson.date).toLocaleDateString('he-IL');
    return `${date} - ${lesson.startTime}`;
  };

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          בקשת החלפת שיעור חד פעמי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MousePointer2 className="h-4 w-4" />
            טיפ: לחצי לחיצה כפולה על שיעור במערכת השבועית למילוי אוטומטי
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lesson">בחרי שיעור או הזיני ידנית</Label>
            <Select value={selectedDate} onValueChange={(value) => {
              setSelectedDate(value);
              const lesson = upcomingLessons.find(l => l.date === value);
              if (lesson) setSelectedTime(lesson.startTime);
            }}>
              <SelectTrigger id="lesson">
                <SelectValue placeholder="בחרי שיעור" />
              </SelectTrigger>
              <SelectContent>
                {upcomingLessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.date}>
                    {formatLessonOption(lesson)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-date">תאריך</Label>
              <Input id="manual-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-time">שעה</Label>
              <Input id="manual-time" type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">עם מי להחליף</Label>
            <Select value={targetStudentId} onValueChange={setTargetStudentId}>
              <SelectTrigger><SelectValue placeholder="בחרי תלמידה" /></SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>{student.firstName} {student.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="swap-code" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />קוד החלפה (אופציונלי)
            </Label>
            <Input id="swap-code" type="text" value={swapCode} onChange={(e) => setSwapCode(e.target.value)} placeholder="קוד החלפה לאישור מיידי" maxLength={10} />
            <p className="text-xs text-muted-foreground">קוד נכון = אישור אוטומטי</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">סיבה</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="הסבירי את הסיבה" rows={3} />
          </div>
        </div>

        <Button onClick={handleSubmitRequest} className="w-full" disabled={!selectedDate || !targetStudentId || !reason.trim()}>
          <Send className="h-4 w-4 ml-2" />שלחי בקשה
        </Button>
      </CardContent>
    </Card>
  );
};

export default SwapRequestForm;

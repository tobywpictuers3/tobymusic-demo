import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Lock, RefreshCw, ArrowRight } from 'lucide-react';
import { getLessons, getStudents } from '@/lib/storage';
import { addSwapRequest, markLessonsAsSwapped } from '@/lib/lessonSwap/store';
import { validateSwap, determineSwapStatus } from '@/lib/lessonSwap/logic';
import { addMessage } from '@/lib/messages';
import { toast } from '@/hooks/use-toast';
import { Lesson } from '@/lib/types';

interface StudentSwapPanelProps {
  studentId: string;
  onLessonClick?: (callback: (lesson: Lesson) => void) => void;
}

type Step = 'my-lesson' | 'target-lesson';

const StudentSwapPanel = ({ studentId, onLessonClick }: StudentSwapPanelProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('my-lesson');
  const [isVerified, setIsVerified] = useState(false);
  
  // My lesson state
  const [myLessonId, setMyLessonId] = useState('');
  const [myLessonDate, setMyLessonDate] = useState('');
  const [myLessonTime, setMyLessonTime] = useState('');
  const [mySwapCode, setMySwapCode] = useState('');
  const [manualMyLesson, setManualMyLesson] = useState(false);
  
  // Target lesson state
  const [targetStudentId, setTargetStudentId] = useState('');
  const [targetLessonId, setTargetLessonId] = useState('');
  const [targetLessonDate, setTargetLessonDate] = useState('');
  const [targetLessonTime, setTargetLessonTime] = useState('');
  const [targetSwapCode, setTargetSwapCode] = useState('');
  const [reason, setReason] = useState('');
  const [manualTargetLesson, setManualTargetLesson] = useState(false);
  
  const students = getStudents();
  const currentStudent = students.find(s => s.id === studentId);
  const otherStudents = students.filter(s => s.id !== studentId);
  const allLessons = getLessons();
  const today = new Date().toISOString().split('T')[0];
  
  const myLessons = allLessons.filter(l => 
    l.studentId === studentId && 
    l.date >= today && 
    l.status === 'scheduled'
  );
  
  // Register lesson click callback for step 1
  const handleMyLessonFromSchedule = (lesson: Lesson) => {
    if (currentStep === 'my-lesson' && !isVerified && lesson.studentId === studentId) {
      setMyLessonId(lesson.id);
      setMyLessonDate(lesson.date);
      setMyLessonTime(lesson.startTime);
      setManualMyLesson(false);
      toast({
        title: 'השיעור נבחר',
        description: `${new Date(lesson.date).toLocaleDateString('he-IL')} בשעה ${lesson.startTime}`,
      });
    }
  };
  
  // Register lesson click callback for step 2
  const handleTargetLessonFromSchedule = (lesson: Lesson) => {
    if (currentStep === 'target-lesson' && isVerified && lesson.studentId !== studentId) {
      setTargetStudentId(lesson.studentId);
      setTargetLessonId(lesson.id);
      setTargetLessonDate(lesson.date);
      setTargetLessonTime(lesson.startTime);
      setManualTargetLesson(false);
      
      const targetStudent = students.find(s => s.id === lesson.studentId);
      toast({
        title: 'השיעור המבוקש נבחר',
        description: `של ${targetStudent?.firstName} ${targetStudent?.lastName} - ${new Date(lesson.date).toLocaleDateString('he-IL')} בשעה ${lesson.startTime}`,
      });
    }
  };
  
  // Handle verification
  const handleVerify = () => {
    if (!currentStudent) return;
    
    const expectedCode = currentStudent.swapCode || currentStudent.personalCode;
    
    if (mySwapCode.trim() === expectedCode) {
      setIsVerified(true);
      setCurrentStep('target-lesson');
      toast({
        title: 'אומת בהצלחה',
        description: 'כעת בחרי את השיעור המבוקש',
      });
    } else {
      toast({
        title: 'קוד שגוי',
        description: 'קוד ההחלפה שהוזן אינו תואם',
        variant: 'destructive',
      });
    }
  };
  
  // Handle submit
  const handleSubmit = async () => {
    if (!currentStudent) return;
    
    // Find or create lesson IDs
    let finalMyLessonId = myLessonId;
    let finalTargetLessonId = targetLessonId;
    
    if (!finalMyLessonId && myLessonDate && myLessonTime) {
      const lesson = allLessons.find(l => 
        l.studentId === studentId && 
        l.date === myLessonDate && 
        l.startTime === myLessonTime
      );
      if (lesson) finalMyLessonId = lesson.id;
    }
    
    if (!finalTargetLessonId && targetLessonDate && targetLessonTime && targetStudentId) {
      const lesson = allLessons.find(l => 
        l.studentId === targetStudentId && 
        l.date === targetLessonDate && 
        l.startTime === targetLessonTime
      );
      if (lesson) finalTargetLessonId = lesson.id;
    }
    
    if (!finalMyLessonId || !finalTargetLessonId || !targetStudentId) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל פרטי השיעורים',
        variant: 'destructive',
      });
      return;
    }
    
    const requestData = {
      requesterStudentId: studentId,
      requesterLessonId: finalMyLessonId,
      targetLessonId: finalTargetLessonId,
      targetStudentId,
      requesterSwapCode: mySwapCode,
      targetSwapCode: targetSwapCode || undefined,
      status: 'pending_manager' as const,
      reason,
    };
    
    // Validate
    const validation = validateSwap(requestData, allLessons, students);
    if (!validation.valid) {
      toast({
        title: 'שגיאה',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }
    
    // Determine status
    const status = determineSwapStatus(requestData, students);
    const finalRequest = { ...requestData, status };
    
    // Create request
    const swapRequest = addSwapRequest(finalRequest);
    
    const targetStudent = students.find(s => s.id === targetStudentId);
    
    if (status === 'auto_approved') {
      // Perform swap immediately
      markLessonsAsSwapped(swapRequest);
      
      // Notify admin and students
      await addMessage({
        senderId: 'system',
        senderName: 'מערכת',
        recipientIds: ['admin'],
        subject: 'החלפת שיעור אושרה אוטומטית',
        content: `החלפה בין ${currentStudent.firstName} ${currentStudent.lastName} ל-${targetStudent?.firstName} ${targetStudent?.lastName}\n\nשיעור של ${currentStudent.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}\nשיעור של ${targetStudent?.firstName}: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n\nסיבה: ${reason || 'לא צוין'}`,
        type: 'system',
      });
      
      await addMessage({
        senderId: 'admin',
        senderName: 'המורה',
        recipientIds: [studentId, targetStudentId],
        subject: 'החלפת שיעור אושרה',
        content: `שלום,\n\nהחלפת השיעור בין ${currentStudent.firstName} ל-${targetStudent?.firstName} אושרה.\n\nהשיעורים החדשים:\n- ${currentStudent.firstName}: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n- ${targetStudent?.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}`,
        type: 'swap_approval',
      });
      
      toast({
        title: 'ההחלפה אושרה!',
        description: 'השיעורים הוחלפו בהצלחה',
      });
    } else {
      // Send to manager
      await addMessage({
        senderId: studentId,
        senderName: `${currentStudent.firstName} ${currentStudent.lastName}`,
        recipientIds: ['admin'],
        subject: 'בקשה להחלפת שיעור',
        content: `בקשה חדשה להחלפת שיעור:\n\nמבקשת: ${currentStudent.firstName} ${currentStudent.lastName}\nתלמידה מבוקשת להחלפה: ${targetStudent?.firstName} ${targetStudent?.lastName}\n\nשיעור של ${currentStudent.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}\nשיעור מבוקש: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n\nסיבה: ${reason || 'לא צוין'}`,
        type: 'swap_request',
      });
      
      toast({
        title: 'הבקשה נשלחה',
        description: 'הבקשה נשלחה לאישור המנהל',
      });
    }
    
    resetForm();
  };
  
  const resetForm = () => {
    setMyLessonId('');
    setMyLessonDate('');
    setMyLessonTime('');
    setTargetStudentId('');
    setTargetLessonId('');
    setTargetLessonDate('');
    setTargetLessonTime('');
    setMySwapCode('');
    setTargetSwapCode('');
    setReason('');
    setIsVerified(false);
    setCurrentStep('my-lesson');
    setManualMyLesson(false);
    setManualTargetLesson(false);
  };
  
  if (!currentStudent) return null;
  
  return (
    <Card className="mt-6 border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
        <CardTitle className="text-2xl">איזור החלפות</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Cube 1: My Lesson */}
          <Card className={`border-2 transition-all ${currentStep === 'my-lesson' ? 'border-primary shadow-md' : 'border-muted'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {isVerified ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
                השיעור שלי להחלפה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!manualMyLesson && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isVerified}
                  onClick={() => {
                    if (onLessonClick) {
                      onLessonClick(handleMyLessonFromSchedule);
                      toast({
                        title: 'בחרי שיעור',
                        description: 'לחצי על השיעור שלך במערכת השבועית',
                      });
                    }
                  }}
                >
                  בחרי את השיעור שלך מהמערכת
                </Button>
              )}
              
              <div className="space-y-2">
                <Label>תאריך השיעור</Label>
                {manualMyLesson ? (
                  <Input
                    type="date"
                    value={myLessonDate}
                    onChange={(e) => setMyLessonDate(e.target.value)}
                    disabled={isVerified}
                  />
                ) : (
                  <Select value={myLessonDate} onValueChange={(val) => {
                    setMyLessonDate(val);
                    const lesson = myLessons.find(l => l.date === val);
                    if (lesson) {
                      setMyLessonId(lesson.id);
                      setMyLessonTime(lesson.startTime);
                    }
                  }} disabled={isVerified}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחרי תאריך" />
                    </SelectTrigger>
                    <SelectContent>
                      {myLessons.map(lesson => (
                        <SelectItem key={lesson.id} value={lesson.date}>
                          {new Date(lesson.date).toLocaleDateString('he-IL')} - {lesson.startTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {myLessonDate && (
                <div className="space-y-2">
                  <Label>שעה</Label>
                  <Input
                    type="time"
                    value={myLessonTime}
                    onChange={(e) => setMyLessonTime(e.target.value)}
                    disabled={isVerified}
                  />
                </div>
              )}
              
              <Button
                variant="link"
                size="sm"
                onClick={() => setManualMyLesson(!manualMyLesson)}
                disabled={isVerified}
                className="text-xs"
              >
                {manualMyLesson ? 'בחירה מהרשימה' : 'הזנה ידנית'}
              </Button>
              
              {myLessonDate && myLessonTime && !isVerified && (
                <>
                  <div className="space-y-2">
                    <Label>קוד ההחלפה שלי *</Label>
                    <Input
                      type="text"
                      maxLength={4}
                      value={mySwapCode}
                      onChange={(e) => setMySwapCode(e.target.value)}
                      placeholder="הזיני את קוד ההחלפה שלך"
                    />
                    <p className="text-xs text-muted-foreground">
                      זהו הקוד האישי שלך להחלפות (ניתן לשנותו בפרטי התלמידה)
                    </p>
                  </div>
                  
                  <Button onClick={handleVerify} className="w-full">
                    אימות והמשך <ArrowRight className="mr-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Cube 2: Target Lesson */}
          <Card className={`border-2 transition-all ${currentStep === 'target-lesson' && isVerified ? 'border-primary shadow-md' : 'border-muted'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {!isVerified && <Lock className="h-5 w-5 text-muted-foreground" />}
                השיעור שאני רוצה לקבל
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isVerified ? (
                <div className="text-center py-12 text-muted-foreground">
                  יש לאמת את השיעור שלך תחילה
                </div>
              ) : (
                <>
                  {!manualTargetLesson && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (onLessonClick) {
                          onLessonClick(handleTargetLessonFromSchedule);
                          toast({
                            title: 'בחרי שיעור',
                            description: 'לחצי על השיעור המבוקש במערכת השבועית',
                          });
                        }
                      }}
                    >
                      בחרי את השיעור המבוקש מהמערכת
                    </Button>
                  )}
                  
                  <div className="space-y-2">
                    <Label>תלמידה</Label>
                    <Select value={targetStudentId} onValueChange={setTargetStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחרי תלמידה" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherStudents.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.firstName} {student.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>תאריך השיעור המבוקש</Label>
                    <Input
                      type="date"
                      value={targetLessonDate}
                      onChange={(e) => setTargetLessonDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>שעה</Label>
                    <Input
                      type="time"
                      value={targetLessonTime}
                      onChange={(e) => setTargetLessonTime(e.target.value)}
                    />
                  </div>
                  
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setManualTargetLesson(!manualTargetLesson)}
                    className="text-xs"
                  >
                    {manualTargetLesson ? 'בחירה מהמערכת' : 'הזנה ידנית'}
                  </Button>
                  
                  <div className="space-y-2">
                    <Label>קוד החלפה של התלמידה (אופציונלי)</Label>
                    <Input
                      type="text"
                      maxLength={4}
                      value={targetSwapCode}
                      onChange={(e) => setTargetSwapCode(e.target.value)}
                      placeholder="קוד החלפה"
                    />
                    <p className="text-xs text-muted-foreground">
                      הזיני קוד החלפה לאישור מיידי. ללא קוד - הבקשה תישלח לאישור מנהל
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>סיבה (אופציונלי)</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="סיבת ההחלפה..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} className="flex-1">
                      שלחי בקשה
                    </Button>
                    <Button onClick={resetForm} variant="outline">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentSwapPanel;

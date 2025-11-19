import { useState, useEffect } from 'react';
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
        variant: 'destructive',
        title: 'קוד שגוי',
        description: 'נסי שוב',
      });
    }
  };
  
  // Submit swap request
  const handleSubmit = () => {
    if (!currentStudent) return;

    // Find lessons
    const myLesson = myLessons.find(l => l.id === myLessonId);
    const targetLesson = allLessons.find(l => l.id === targetLessonId);

    if (!myLesson || !targetLesson) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'נא לבחור שיעורים תקינים',
      });
      return;
    }

    // Build request
    const request = {
      requesterStudentId: studentId,
      requesterLessonId: myLessonId,
      targetLessonId: targetLessonId,
      targetStudentId: targetStudentId,
      requesterSwapCode: mySwapCode,
      targetSwapCode: targetSwapCode || undefined,
      status: 'pending_manager' as const,
      reason,
    };

    // Validate
    const validation = validateSwap(request, allLessons, students);
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: validation.error,
      });
      return;
    }

    // Determine status
    const finalStatus = determineSwapStatus(request, students);
    const finalRequest = { ...request, status: finalStatus };

    // Add request
    const createdRequest = addSwapRequest(finalRequest);

    // If auto-approved, mark lessons as swapped
    if (finalStatus === 'auto_approved') {
      markLessonsAsSwapped(createdRequest);
      
      toast({
        title: 'בקשת החלפה אושרה!',
        description: 'השיעורים הוחלפו בהצלחה',
      });

      // Send messages
      const targetStudent = students.find(s => s.id === targetStudentId);
      addMessage({
        senderId: 'admin',
        senderName: 'מערכת',
        recipientIds: [studentId],
        subject: 'בקשת החלפה אושרה',
        content: `בקשת ההחלפה שלך עם ${targetStudent?.firstName} ${targetStudent?.lastName} אושרה אוטומטית`,
        type: 'swap_approval',
      });

      addMessage({
        senderId: 'admin',
        senderName: 'מערכת',
        recipientIds: [targetStudentId],
        subject: 'שיעור הוחלף',
        content: `השיעור שלך הוחלף עם ${currentStudent.firstName} ${currentStudent.lastName}`,
        type: 'swap_approval',
      });
    } else {
      toast({
        title: 'בקשת החלפה נשלחה',
        description: 'הבקשה ממתינה לאישור המנהל',
      });

      // Send message to admin
      const targetStudent = students.find(s => s.id === targetStudentId);
      addMessage({
        senderId: studentId,
        senderName: `${currentStudent.firstName} ${currentStudent.lastName}`,
        recipientIds: ['admin'],
        subject: 'בקשת החלפת שיעור',
        content: `${currentStudent.firstName} ${currentStudent.lastName} מבקשת להחליף שיעור עם ${targetStudent?.firstName} ${targetStudent?.lastName}. סיבה: ${reason || 'לא צוין'}`,
        type: 'swap_request',
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setCurrentStep('my-lesson');
    setIsVerified(false);
    setMyLessonId('');
    setMyLessonDate('');
    setMyLessonTime('');
    setMySwapCode('');
    setTargetStudentId('');
    setTargetLessonId('');
    setTargetLessonDate('');
    setTargetLessonTime('');
    setTargetSwapCode('');
    setReason('');
    setManualMyLesson(false);
    setManualTargetLesson(false);
  };

  // Register callbacks with parent
  useEffect(() => {
    if (!onLessonClick) return;
    
    if (currentStep === 'my-lesson' && !isVerified) {
      onLessonClick(handleMyLessonFromSchedule);
    } else if (currentStep === 'target-lesson' && isVerified) {
      onLessonClick(handleTargetLessonFromSchedule);
    }
  }, [currentStep, isVerified, onLessonClick]);

  if (!currentStudent) {
    return null;
  }

  return (
    <Card className="card-gradient card-shadow mt-8">
      <CardHeader>
        <CardTitle className="text-2xl">🔄 החלפת שיעורים - בדיקה</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Step 1: My Lesson */}
          <div className={`p-6 rounded-lg border-2 ${currentStep === 'my-lesson' ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVerified ? 'bg-green-500' : 'bg-primary'}`}>
                {isVerified ? <Check className="h-5 w-5 text-white" /> : <span className="text-white font-bold">1</span>}
              </div>
              <h3 className="text-lg font-semibold">השיעור שלי</h3>
            </div>

            {!isVerified ? (
              <div className="space-y-4">
                {!manualMyLesson ? (
                  <>
                    <div>
                      <Label>בחרי שיעור מהמערכת</Label>
                      <Select value={myLessonId} onValueChange={(val) => {
                        const lesson = myLessons.find(l => l.id === val);
                        if (lesson) {
                          setMyLessonId(val);
                          setMyLessonDate(lesson.date);
                          setMyLessonTime(lesson.startTime);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחרי שיעור" />
                        </SelectTrigger>
                        <SelectContent>
                          {myLessons.map(lesson => (
                            <SelectItem key={lesson.id} value={lesson.id}>
                              {new Date(lesson.date).toLocaleDateString('he-IL')} - {lesson.startTime}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setManualMyLesson(true)}
                      className="w-full"
                    >
                      הזנה ידנית
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>תאריך</Label>
                      <Input 
                        type="date" 
                        value={myLessonDate} 
                        onChange={(e) => setMyLessonDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>שעה</Label>
                      <Input 
                        type="time" 
                        value={myLessonTime} 
                        onChange={(e) => setMyLessonTime(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setManualMyLesson(false)}
                      className="w-full"
                    >
                      בחירה מהרשימה
                    </Button>
                  </>
                )}

                <div>
                  <Label>הקוד שלך</Label>
                  <Input 
                    type="text"
                    value={mySwapCode}
                    onChange={(e) => setMySwapCode(e.target.value)}
                    placeholder="הזיני קוד החלפה"
                  />
                </div>

                <Button 
                  onClick={handleVerify}
                  disabled={!myLessonId || !mySwapCode}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 ml-2" />
                  אמת ועבור לשלב 2
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ תאריך: {new Date(myLessonDate).toLocaleDateString('he-IL')}</p>
                <p>✓ שעה: {myLessonTime}</p>
                <p className="text-green-600 font-semibold">אומת!</p>
              </div>
            )}
          </div>

          {/* Step 2: Target Lesson */}
          <div className={`p-6 rounded-lg border-2 ${currentStep === 'target-lesson' && isVerified ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVerified ? 'bg-primary' : 'bg-muted'}`}>
                <span className="text-white font-bold">2</span>
              </div>
              <h3 className="text-lg font-semibold">השיעור המבוקש</h3>
            </div>

            {!isVerified ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>השלימי קודם שלב 1</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!manualTargetLesson ? (
                  <>
                    <div>
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

                    {targetStudentId && (
                      <div>
                        <Label>שיעור</Label>
                        <Select value={targetLessonId} onValueChange={(val) => {
                          const lesson = allLessons.find(l => l.id === val);
                          if (lesson) {
                            setTargetLessonId(val);
                            setTargetLessonDate(lesson.date);
                            setTargetLessonTime(lesson.startTime);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="בחרי שיעור" />
                          </SelectTrigger>
                          <SelectContent>
                            {allLessons
                              .filter(l => l.studentId === targetStudentId && l.date >= today && l.status === 'scheduled')
                              .map(lesson => (
                                <SelectItem key={lesson.id} value={lesson.id}>
                                  {new Date(lesson.date).toLocaleDateString('he-IL')} - {lesson.startTime}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setManualTargetLesson(true)}
                      className="w-full"
                    >
                      הזנה ידנית
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>תאריך</Label>
                      <Input 
                        type="date" 
                        value={targetLessonDate} 
                        onChange={(e) => setTargetLessonDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>שעה</Label>
                      <Input 
                        type="time" 
                        value={targetLessonTime} 
                        onChange={(e) => setTargetLessonTime(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setManualTargetLesson(false)}
                      className="w-full"
                    >
                      בחירה מהרשימה
                    </Button>
                  </>
                )}

                <div>
                  <Label>קוד החלפה של התלמידה השנייה (אופציונלי)</Label>
                  <Input 
                    type="text"
                    value={targetSwapCode}
                    onChange={(e) => setTargetSwapCode(e.target.value)}
                    placeholder="לאישור אוטומטי"
                  />
                </div>

                <div>
                  <Label>סיבה להחלפה</Label>
                  <Textarea 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="למה את רוצה להחליף?"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-6 justify-center">
          <Button 
            onClick={resetForm}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 ml-2" />
            איפוס
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isVerified || !targetLessonId}
            className="min-w-[200px]"
          >
            <ArrowRight className="h-4 w-4 ml-2" />
            שלח בקשת החלפה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentSwapPanel;

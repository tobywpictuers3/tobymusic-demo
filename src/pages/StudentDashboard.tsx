import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, User, Phone, FileText } from 'lucide-react';
import { getCurrentUser, setCurrentUser, getStudents } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { Student, Lesson } from '@/lib/types';
import { getAllLessonsIncludingTemplates } from '@/lib/lessonUtils';
import { useAccessMode } from '@/contexts/AccessModeContext';
import { clearClientCaches } from '@/lib/cacheManager';
import GeneralWeeklySchedule from '@/components/student/GeneralWeeklySchedule';
import SwapRequestForm from '@/components/student/SwapRequestForm';
import SwapRequestsStatus from '@/components/student/SwapRequestsStatus';
import EditableStudentDetails from '@/components/student/EditableStudentDetails';
import ContactsList from '@/components/student/ContactsList';
import StudentFiles from '@/components/student/StudentFiles';
import PaymentAlert from '@/components/student/PaymentAlert';
import PaymentSummary from '@/components/student/PaymentSummary';
import LessonHistory from '@/components/student/LessonHistory';
import PracticeTracking from '@/components/student/PracticeTracking';
import GmailStyleMessages from '@/components/student/GmailStyleMessages';
import BroadcastMessageBanner from '@/components/student/BroadcastMessageBanner';
import StarredMessagesBanner from '@/components/student/StarredMessagesBanner';
import MessageAlert from '@/components/student/MessageAlert';
import MedalCollection from '@/components/student/MedalCollection';
import MedalStore from '@/components/student/MedalStore';
import BackButton from '@/components/ui/back-button';
import { SaveButton } from '@/components/ui/save-button';
import { UnreadMessagesBadge } from '@/components/ui/unread-messages-badge';
import StudentSwapPanel, { StudentSwapPanelRef } from '@/components/student/lessonSwap/StudentSwapPanel';

const StudentDashboard = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule');
  const [student, setStudent] = useState<Student | null>(null);
  const { isPublicMode, setAccessMode } = useAccessMode();
  const [swapPanelRef, setSwapPanelRef] = useState<StudentSwapPanelRef | null>(null);
  const [currentSwapStep, setCurrentSwapStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSwapSelectionActive, setIsSwapSelectionActive] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Load lessons on mount
  useEffect(() => {
    setLessons(getAllLessonsIncludingTemplates());
  }, []);

  // Refresh lessons function - receives new lessons from swap panel
  const refreshLessons = (newLessons: Lesson[]) => {
    setLessons(newLessons);
  };

  // Sync isSwapSelectionActive with currentStep from SwapPanel
  useEffect(() => {
    console.log('[StudentDashboard] currentSwapStep changed to:', currentSwapStep);
    console.log('[StudentDashboard] Setting isSwapSelectionActive to:', currentSwapStep === 2 || currentSwapStep === 3);
    setIsSwapSelectionActive(currentSwapStep === 2 || currentSwapStep === 3);
  }, [currentSwapStep]);

  useEffect(() => {
    const user = getCurrentUser();
    const devMode = sessionStorage.getItem('musicSystem_devMode') === 'true';
    
    // Public mode - show empty view
    if (studentId === 'public') {
      if (!user || user.type !== 'public_view') {
        navigate('/');
        toast({
          title: 'שגיאת גישה',
          description: 'נדרשת כניסה תקינה',
          variant: 'destructive',
        });
        return;
      }
      setAccessMode('public');
      // Set empty student for public view
      setStudent({
        id: 'public',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        personalCode: '',
        swapCode: '0000', // Default swap code for public view
        startDate: '',
        startingLessonNumber: 1,
        annualAmount: 0,
        paymentMonths: 12,
        monthlyAmount: 0,
      });
      return;
    }
    
    // Developer mode - allow access to mock students
    if (devMode && user && user.type === 'student') {
      const students = getStudents();
      const currentStudent = students.find(s => s.id === studentId);
      if (currentStudent) {
        setAccessMode('private');
        setStudent(currentStudent);
        return;
      }
    }
    
    // Private mode - regular student
    if (!user || user.type !== 'student' || user.studentId !== studentId) {
      navigate('/');
      toast({
        title: 'שגיאת גישה',
        description: 'נדרשת כניסת תלמידה',
        variant: 'destructive',
      });
      return;
    }

    const students = getStudents();
    const currentStudent = students.find(s => s.id === studentId);
    if (currentStudent) {
      setAccessMode('private');
      setStudent(currentStudent);
    } else {
      navigate('/');
      toast({
        title: 'שגיאה',
        description: 'תלמידה לא נמצאה',
        variant: 'destructive',
      });
    }
  }, [studentId, navigate, setAccessMode]);

  const handleLogout = async () => {
    await clearClientCaches();
    setCurrentUser(null);
    navigate('/');
    toast({
      title: 'התנתקות מוצלחת',
      description: 'נתראה בפעם הבאה!',
    });
  };

  const handleLessonDoubleClick = (lesson: Lesson) => {
    if (swapPanelRef) {
      swapPanelRef.handleLessonDoubleClick(lesson);
    }
  };

  if (!student) {
    return <div className="min-h-screen musical-gradient flex items-center justify-center">
      <div className="text-primary text-xl">טוען...</div>
    </div>;
  }

  const allStudents = getStudents();

  return (
    <div className="min-h-screen musical-gradient">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-background via-background to-background/95 backdrop-blur-sm border-b border-primary/20 shadow-lg">
        <div className="container mx-auto p-4">
          <Card className="card-gradient card-shadow">
            <CardHeader className="py-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <BackButton to="/" label="חזור לדף הבית" />
                  {!isPublicMode && (
                    <div className="flex gap-2 items-center">
                      <UnreadMessagesBadge userId={student.id} />
                      <div className="relative">
                        <SaveButton />
                        <div className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <CardTitle className="text-2xl md:text-3xl flex items-center gap-3 text-primary crown-glow">
                  <User className="h-6 w-6 md:h-8 md:w-8" />
                  {isPublicMode ? 'מצב תצוגה כללית' : `אזור אישי - ${student.firstName} ${student.lastName}`}
                </CardTitle>
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  className="flex items-center gap-2 text-card-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  התנתק
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6 pt-2">

        {/* Starred Messages Banner - Above everything */}
        {!isPublicMode && <StarredMessagesBanner studentId={studentId!} />}

        {/* Broadcast Messages Banner */}
        {!isPublicMode && <BroadcastMessageBanner studentId={studentId!} />}

        {/* Payment Alerts - Hide in public mode */}
        {!isPublicMode && <PaymentAlert studentId={studentId!} />}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 bg-secondary/20 backdrop-blur">
            <TabsTrigger value="schedule" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              מערכת שבועית
            </TabsTrigger>
            <TabsTrigger value="practice" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              מעקב אימונים
            </TabsTrigger>
            <TabsTrigger value="medals" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              🏆 המדליות שלי
            </TabsTrigger>
            <TabsTrigger value="store" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              🛒 חנות
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Calendar className="h-4 w-4" />
              היסטוריית שיעורים
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Calendar className="h-4 w-4" />
              תקשורת
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <User className="h-4 w-4" />
              הפרטים שלי
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Phone className="h-4 w-4" />
              פרטי קשר
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <FileText className="h-4 w-4" />
              קבצים אישיים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            {isPublicMode ? (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <p className="text-lg">מצב תצוגה כללית - רק נתונים ציבוריים מוצגים</p>
                    <p className="text-muted-foreground">להתחברות עם קוד אישי, חזרי לדף הבית</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <GeneralWeeklySchedule 
                  studentId={student.id}
                  lessons={lessons}
                  onLessonDoubleClick={handleLessonDoubleClick}
                  isSelectionActive={isSwapSelectionActive}
                  currentSwapStep={currentSwapStep}
                />
                {student && (
                  <StudentSwapPanel 
                    student={student} 
                    lessons={lessons}
                    students={allStudents}
                    onMount={(ref) => setSwapPanelRef(ref)}
                    onStepChange={(step) => setCurrentSwapStep(step)}
                    onSwapCompleted={refreshLessons}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="practice" className="space-y-6">
            <PracticeTracking studentId={studentId!} />
          </TabsContent>

          <TabsContent value="medals" className="space-y-6">
            <MedalCollection studentId={studentId!} />
          </TabsContent>

          <TabsContent value="store" className="space-y-6">
            <MedalStore studentId={studentId!} />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <LessonHistory student={student} />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <GmailStyleMessages 
              studentId={studentId!} 
              studentName={`${student?.firstName || ''} ${student?.lastName || ''}`}
            />
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <PaymentSummary studentId={studentId!} />
            <EditableStudentDetails student={student} onUpdate={() => {
              const students = getStudents();
              const updatedStudent = students.find(s => s.id === studentId);
              if (updatedStudent) setStudent(updatedStudent);
            }} />
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <ContactsList />
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <StudentFiles studentId={studentId!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentDashboard;

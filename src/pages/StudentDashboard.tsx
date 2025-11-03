
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, User, Phone, Mail, MessageSquare, FileText } from 'lucide-react';
import { getCurrentUser, setCurrentUser, getStudents } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { Student } from '@/lib/types';
import StudentWeeklySchedule from '@/components/student/StudentWeeklySchedule';
import SwapRequestForm from '@/components/student/SwapRequestForm';
import SwapRequestsStatus from '@/components/student/SwapRequestsStatus';
import EditableStudentDetails from '@/components/student/EditableStudentDetails';
import ContactsList from '@/components/student/ContactsList';
import StudentFiles from '@/components/student/StudentFiles';
import PaymentAlert from '@/components/student/PaymentAlert';
import PaymentSummary from '@/components/student/PaymentSummary';
import LessonHistory from '@/components/student/LessonHistory';
import PracticeTracking from '@/components/student/PracticeTracking';
import MedalCollection from '@/components/student/MedalCollection';
import MedalStore from '@/components/student/MedalStore';
import BackButton from '@/components/ui/back-button';
import { SaveButton } from '@/components/ui/save-button';

const StudentDashboard = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule');
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
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
      setStudent(currentStudent);
    } else {
      navigate('/');
      toast({
        title: 'שגיאה',
        description: 'תלמידה לא נמצאה',
        variant: 'destructive',
      });
    }
  }, [studentId, navigate]);

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/');
    toast({
      title: 'התנתקות מוצלחת',
      description: 'נתראה בפעם הבאה!',
    });
  };

  if (!student) {
    return <div className="min-h-screen musical-gradient flex items-center justify-center">
      <div className="text-primary text-xl">טוען...</div>
    </div>;
  }

  return (
    <div className="min-h-screen musical-gradient">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <Card className="card-gradient card-shadow">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <BackButton to="/" label="חזור לדף הבית" />
                <SaveButton />
              </div>
              <CardTitle className="text-3xl flex items-center gap-3 text-primary crown-glow">
                <User className="h-8 w-8" />
                אזור אישי - {student.firstName} {student.lastName}
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

        {/* Payment Alerts */}
        <PaymentAlert studentId={studentId!} />

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 bg-secondary/20 backdrop-blur">
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
            <TabsTrigger value="history" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              היסטוריית שיעורים
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <User className="h-4 w-4" />
              הפרטים שלי
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Phone className="h-4 w-4" />
              פרטי קשר
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <FileText className="h-4 w-4" />
              קבצים אישיים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            <Card className="card-gradient card-shadow">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <p className="text-lg">לבקשת החלפת שיעור, יש לעבור למערכת התלמידות</p>
                  <Button 
                    onClick={() => navigate('/students-view')}
                    className="mx-auto flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    מעבר למערכת התלמידות לבקשת החלפה
                  </Button>
                </div>
              </CardContent>
            </Card>
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

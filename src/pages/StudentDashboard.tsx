import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar, User, Phone, FileText } from "lucide-react";
import { getCurrentUser, setCurrentUser, getStudents } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { Student, Lesson } from "@/lib/types";
import { getAllLessonsIncludingTemplates } from "@/lib/lessonUtils";
import { useAccessMode } from "@/contexts/AccessModeContext";
import { clearClientCaches } from "@/lib/cacheManager";

import EditableStudentDetails from "@/components/student/EditableStudentDetails";
import GeneralWeeklySchedule from "@/components/student/GeneralWeeklySchedule";
import ContactsList from "@/components/student/ContactsList";
import StudentFiles from "@/components/student/StudentFiles";
import PaymentAlert from "@/components/student/PaymentAlert";
import PaymentSummary from "@/components/student/PaymentSummary";
import LessonHistory from "@/components/student/LessonHistory";
import PracticeTracking from "@/components/student/PracticeTracking";
import GmailStyleMessages from "@/components/student/GmailStyleMessages";
import BroadcastMessageBanner from "@/components/student/BroadcastMessageBanner";
import StarredMessagesBanner from "@/components/student/StarredMessagesBanner";
import MedalCollection from "@/components/student/MedalCollection";
import MedalStore from "@/components/student/MedalStore";
import BackButton from "@/components/ui/back-button";
import { SaveButton } from "@/components/ui/save-button";
import { UnreadMessagesBadge } from "@/components/ui/unread-messages-badge";
import StudentSwapPanel, { StudentSwapPanelRef } from "@/components/student/lessonSwap/StudentSwapPanel";

import Metronome from "./Metronome";

const StudentDashboard = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { accessMode } = useAccessMode();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState("schedule");
  const [saving, setSaving] = useState(false);

  const studentSwapPanelRef = useState<StudentSwapPanelRef | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // אם זה אזור "public" (לצפייה מוגבלת) – ודאי שיש לוגיקה אצלך שתומכת בזה
        if (studentId === "public") {
          // במקרה שאין פה תלמיד אמיתי, ננווט החוצה כדי לא לקרוס
          navigate("/", { replace: true });
          return;
        }

        const current = getCurrentUser();
        if (!current) {
          // אם אין משתמש – נשלח למסך כניסה/בית
          navigate("/", { replace: true });
          return;
        }

        // מציאת תלמיד לפי פרמטר
        const students = getStudents();
        const found = students.find((s) => s?.id === studentId);

        if (!found) {
          toast({
            title: "תלמיד לא נמצא",
            description: "לא נמצאו פרטי תלמיד עבור הקישור הזה.",
            variant: "destructive",
          });
          navigate("/", { replace: true });
          return;
        }

        setStudent(found);

        const allLessons = getAllLessonsIncludingTemplates();
        setLessons(allLessons);
      } catch (e) {
        console.error(e);
        toast({
          title: "שגיאה",
          description: "לא הצלחנו לטעון את האזור האישי.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
      }
    };

    load();
  }, [studentId, navigate]);

  // ✅ חשוב: אם student עדיין לא נטען – לא מרנדרים UI שמשתמש ב-student.id
  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-lg font-semibold">טוען אזור אישי…</div>
          <div className="text-sm text-muted-foreground mt-2">רגע אחד</div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    setCurrentUser(null);
    clearClientCaches();
    toast({ title: "התנתקת בהצלחה" });
    navigate("/", { replace: true });
  };

  const handleStudentUpdate = () => {
    // Refresh student data
    const students = getStudents();
    const found = students.find((s) => s?.id === student.id);
    if (found) {
      setStudent(found);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="text-xl md:text-2xl font-bold">
              אזור אישי — {student.firstName} {student.lastName}
            </div>
            <div className="text-sm text-muted-foreground">
              ID: {student.id}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UnreadMessagesBadge userId={student.id} />
          <SaveButton />
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            התנתקות
          </Button>
        </div>
      </div>

      <BroadcastMessageBanner studentId={student.id} />
      <StarredMessagesBanner studentId={student.id} />

      <PaymentAlert studentId={student.id} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-10 gap-2 h-auto">
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="w-4 h-4" />
            מערכת שבועית
          </TabsTrigger>

          <TabsTrigger value="practice">מעקב אימונים</TabsTrigger>
          <TabsTrigger value="metronome">מטרונום</TabsTrigger>

          <TabsTrigger value="medals">המדליות שלי</TabsTrigger>
          <TabsTrigger value="store">חנות</TabsTrigger>
          <TabsTrigger value="history">היסטוריית שיעורים</TabsTrigger>

          <TabsTrigger value="messages" className="gap-2">
            <FileText className="w-4 h-4" />
            הודעות
          </TabsTrigger>

          <TabsTrigger value="details" className="gap-2">
            <User className="w-4 h-4" />
            פרטים שלי
          </TabsTrigger>

          <TabsTrigger value="contacts" className="gap-2">
            <Phone className="w-4 h-4" />
            אנשי קשר
          </TabsTrigger>

          <TabsTrigger value="files">קבצים</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          <GeneralWeeklySchedule studentId={student.id} lessons={lessons} />
        </TabsContent>

        <TabsContent value="practice" className="space-y-6">
          <PracticeTracking studentId={student.id} />
        </TabsContent>

        <TabsContent value="metronome" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>המטרונום של טובי</CardTitle>
            </CardHeader>
            <CardContent>
              <Metronome />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medals" className="space-y-6">
          <MedalCollection studentId={student.id} />
        </TabsContent>

        <TabsContent value="store" className="space-y-6">
          <MedalStore studentId={student.id} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <LessonHistory student={student} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <GmailStyleMessages studentId={student.id} studentName={`${student.firstName} ${student.lastName}`} />
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <EditableStudentDetails student={student} onUpdate={handleStudentUpdate} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <ContactsList />
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <StudentFiles studentId={student.id} />
        </TabsContent>
      </Tabs>

      {/* אם יש לך את StudentSwapPanel בפועל – תשאירי אותו כמו אצלך.
          כאן אני לא "ממציא" שימוש כדי לא לשבור לוגיקה קיימת. */}
    </div>
  );
};

export default StudentDashboard;

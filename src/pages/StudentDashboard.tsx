import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar, User, Phone, FileText } from "lucide-react";
import { getCurrentUser, setCurrentUser, getStudents } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { Student, Lesson } from "@/lib/types";
import { getAllLessonsIncludingTemplates } from "@/lib/lessonUtils";
import { clearClientCaches } from "@/lib/cacheManager";

import EditableStudentDetails from "@/components/student/EditableStudentDetails";
import GeneralWeeklySchedule from "@/components/student/GeneralWeeklySchedule";
import ContactsList from "@/components/student/ContactsList";
import StudentFiles from "@/components/student/StudentFiles";
import PaymentAlert from "@/components/student/PaymentAlert";
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
import SyncStatusBadge from "@/components/ui/SyncStatusBadge";

import Metronome from "./Metronome";

// ✅ הלוגיקה העדכנית של החלפות (קודים + בחירת שיעורים + אישור אוטומטי)
import StudentSwapPanel, {
  StudentSwapPanelRef,
} from "@/components/student/lessonSwap/StudentSwapPanel";

const StudentDashboard = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState("schedule");

  // Swap wiring (latest logic)
  const [swapPanelRef, setSwapPanelRef] = useState<StudentSwapPanelRef | null>(
    null
  );
  const [currentSwapStep, setCurrentSwapStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSwapSelectionActive, setIsSwapSelectionActive] = useState(false);

  // keep schedule highlight in sync with swap step (2-3 = selection)
  useEffect(() => {
    setIsSwapSelectionActive(currentSwapStep === 2 || currentSwapStep === 3);
  }, [currentSwapStep]);

  useEffect(() => {
    const load = async () => {
      try {
        if (studentId === "public") {
          navigate("/", { replace: true });
          return;
        }

        const current = getCurrentUser();
        if (!current) {
          navigate("/", { replace: true });
          return;
        }

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

        // load lessons (including templates)
        setLessons(getAllLessonsIncludingTemplates());
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

  const refreshLessons = () => {
    setLessons(getAllLessonsIncludingTemplates());
  };

  const handleLessonDoubleClick = (lesson: Lesson) => {
    if (swapPanelRef) {
      swapPanelRef.handleLessonDoubleClick(lesson);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearClientCaches();
    toast({ title: "התנתקת בהצלחה" });
    navigate("/", { replace: true });
  };

  const handleStudentUpdate = () => {
    const students = getStudents();
    const found = students.find((s) => s?.id === student.id);
    if (found) setStudent(found);
  };

  const allStudents = getStudents();

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="text-xl md:text-2xl font-bold">
              אזור אישי — {student.firstName} {student.lastName}
            </div>
            <div className="text-sm text-muted-foreground">ID: {student.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <UnreadMessagesBadge userId={student.id} />
          <SyncStatusBadge />
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
          <TabsTrigger value="aids">עזרים</TabsTrigger>

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

        {/* ✅ מערכת שבועית + החלפות (הלוגיקה החדשה) */}
        <TabsContent value="schedule" className="space-y-6">
          <GeneralWeeklySchedule
            studentId={student.id}
            lessons={lessons}
            onLessonDoubleClick={handleLessonDoubleClick}
            isSelectionActive={isSwapSelectionActive}
            currentSwapStep={currentSwapStep}
          />

          <StudentSwapPanel
            student={student}
            lessons={lessons}
            students={allStudents}
            onMount={(ref) => setSwapPanelRef(ref)}
            onStepChange={(step) => setCurrentSwapStep(step)}
            onSwapCompleted={refreshLessons}
          />
        </TabsContent>

        <TabsContent value="practice" className="space-y-6">
          <PracticeTracking studentId={student.id} />
        </TabsContent>

        <TabsContent value="aids" className="space-y-6">
          <Metronome />
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
          <GmailStyleMessages
            studentId={student.id}
            studentName={`${student.firstName} ${student.lastName}`}
          />
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
    </div>
  );
};

export default StudentDashboard;

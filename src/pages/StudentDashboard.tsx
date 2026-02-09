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
import { ASSETS } from "@/brand/assets";

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
import BrandSection from "@/components/ui/BrandSection";

import Metronome from "./Metronome";

import StudentSwapPanel, {
  StudentSwapPanelRef,
} from "@/components/student/lessonSwap/StudentSwapPanel";

const StudentDashboard = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState("practice"); // Practice first

  const [swapPanelRef, setSwapPanelRef] = useState<StudentSwapPanelRef | null>(null);
  const [currentSwapStep, setCurrentSwapStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSwapSelectionActive, setIsSwapSelectionActive] = useState(false);

  // Broadcast messages collapsed state
  const [showAllBroadcasts, setShowAllBroadcasts] = useState(false);
  const [showAllStarred, setShowAllStarred] = useState(false);

  useEffect(() => {
    setLessons(getAllLessonsIncludingTemplates());
  }, []);

  const refreshLessons = () => {
    setLessons(getAllLessonsIncludingTemplates());
  };

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

  const handleLogout = () => {
    setCurrentUser(null);
    clearClientCaches();
    toast({ title: "התנתקת בהצלחה" });
    navigate("/", { replace: true });
  };

  const handleStudentUpdate = () => {
    const students = getStudents();
    const found = students.find((s) => s?.id === student?.id);
    if (found) setStudent(found);
  };

  const handleLessonDoubleClick = (lesson: Lesson) => {
    swapPanelRef?.handleLessonDoubleClick(lesson);
  };

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

  const allStudents = getStudents();

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 relative z-10">
      {/* Header with title glow */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="text-xl md:text-2xl font-bold title-glow">
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

      {/* Broadcast messages – collapsed to 1 */}
      <CollapsedBanner show={showAllBroadcasts} onToggle={() => setShowAllBroadcasts(!showAllBroadcasts)}>
        <BroadcastMessageBanner studentId={student.id} />
      </CollapsedBanner>

      <CollapsedBanner show={showAllStarred} onToggle={() => setShowAllStarred(!showAllStarred)}>
        <StarredMessagesBanner studentId={student.id} />
      </CollapsedBanner>

      <PaymentAlert studentId={student.id} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-10 gap-2 h-auto">
          {/* Practice first */}
          <TabsTrigger value="practice">מעקב אימונים</TabsTrigger>

          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="w-4 h-4" />
            מערכת שבועית
          </TabsTrigger>

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

        {/* Practice first with red background */}
        <TabsContent value="practice" className="fade-slide-in">
          <BrandSection backgroundUrl={ASSETS.backgrounds.red}>
            <div className="p-4">
              <PracticeTracking studentId={student.id} />
            </div>
          </BrandSection>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6 fade-slide-in">
          <BrandSection backgroundUrl={ASSETS.backgrounds.gold}>
            <div className="p-4">
              <GeneralWeeklySchedule
                studentId={student.id}
                lessons={lessons}
                onLessonDoubleClick={handleLessonDoubleClick}
                isSelectionActive={isSwapSelectionActive}
                currentSwapStep={currentSwapStep}
              />
            </div>
          </BrandSection>

          <StudentSwapPanel
            student={student}
            lessons={lessons}
            students={allStudents}
            onMount={(ref) => setSwapPanelRef(ref)}
            onStepChange={(step) => setCurrentSwapStep(step)}
            onSwapCompleted={() => refreshLessons()}
          />
        </TabsContent>

        <TabsContent value="aids" className="space-y-6 fade-slide-in">
          <BrandSection backgroundUrl={ASSETS.backgrounds.ard}>
            <div className="p-4">
              <Metronome />
            </div>
          </BrandSection>
        </TabsContent>

        <TabsContent value="medals" className="space-y-6 fade-slide-in">
          <BrandSection backgroundUrl={ASSETS.backgrounds.lightGold}>
            <div className="p-4">
              <MedalCollection studentId={student.id} />
            </div>
          </BrandSection>
        </TabsContent>

        <TabsContent value="store" className="space-y-6 fade-slide-in">
          <MedalStore studentId={student.id} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6 fade-slide-in">
          <LessonHistory student={student} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6 fade-slide-in">
          <GmailStyleMessages
            studentId={student.id}
            studentName={`${student.firstName} ${student.lastName}`}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-6 fade-slide-in">
          <EditableStudentDetails student={student} onUpdate={handleStudentUpdate} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6 fade-slide-in">
          <ContactsList />
        </TabsContent>

        <TabsContent value="files" className="space-y-6 fade-slide-in">
          <StudentFiles studentId={student.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** Helper: shows only 1 line of children content, with an expand button */
const CollapsedBanner = ({
  children,
  show,
  onToggle,
}: {
  children: React.ReactNode;
  show: boolean;
  onToggle: () => void;
}) => (
  <div>
    <div className={show ? "" : "max-h-[80px] overflow-hidden relative"}>
      {children}
      {!show && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
      )}
    </div>
    <Button variant="ghost" size="sm" onClick={onToggle} className="text-xs mt-1">
      {show ? "הסתר" : "הצג עוד"}
    </Button>
  </div>
);

export default StudentDashboard;

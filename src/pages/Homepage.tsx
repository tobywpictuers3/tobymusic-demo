import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, Phone, MessageCircle } from "lucide-react";
import { getStudents, setCurrentUser, setDevMode } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { useAccessMode } from "@/contexts/AccessModeContext";
import { ThemeToggle } from "@/brand/ThemeToggle";
import { TOBY_LOGO_3D_URL } from "@/brand/tobyBrand";
import BsiataDishmaya from "@/components/ui/BsiataDishmaya";

const Homepage = () => {
  const [adminCode, setAdminCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const navigate = useNavigate();
  const { setAccessMode } = useAccessMode();

  const handleAdminLogin = async () => {
    if (adminCode === "toby2026") {
      setDevMode(false);
      sessionStorage.removeItem("musicSystem_devMode");

      setCurrentUser({ type: "admin", adminCode });
      navigate("/admin");

      toast({
        title: "ברוך הבא!",
        description: "התחברת כמנהל מערכת",
      });
    } else {
      toast({
        title: "שגיאה",
        description: "קוד מנהל שגוי",
        variant: "destructive",
      });
    }
  };

  const handleDevAdminLogin = async () => {
    if (adminCode === "1234E") {
      setDevMode(true);
      sessionStorage.setItem("musicSystem_devMode", "true");

      setCurrentUser({ type: "admin", adminCode });
      navigate("/dev-admin");

      toast({
        title: "🔧 מצב מפתחים",
        description: "נכנסת למצב מפתחים מבודד (ללא Worker)",
      });
    } else {
      toast({
        title: "שגיאה",
        description: "קוד מפתחים שגוי",
        variant: "destructive",
      });
    }
  };

  const handleStudentLogin = () => {
    if (!studentCode.trim()) {
      toast({
        title: "שגיאה",
        description: "אנא הקישי את הקוד האישי שלך",
        variant: "destructive",
      });
      return;
    }

    if (studentCode.trim().toUpperCase() === "STUDENTS2026") {
      setAccessMode("public");
      setCurrentUser({ type: "public_view" });
      navigate("/student/public");
      toast({
        title: "מצב תצוגה כללית",
        description: "נכנסת למצב צפייה בלבד",
      });
      return;
    }

    const students = getStudents();
    let student = students.find((s) => s.personalCode === studentCode.trim());

    if (!student) {
      student = students.find((s) => s.phone === studentCode.trim());
    }

    if (student) {
      setAccessMode("private");
      setCurrentUser({ type: "student", studentId: student.id });
      navigate(`/student/${student.id}`);
      toast({
        title: "ברוכה הבאה לאזור האישי!",
        description: `שלום ${student.firstName} ${student.lastName}`,
      });
    } else {
      toast({
        title: "שגיאה",
        description: "קוד אישי שגוי. אנא פני למנהלת לקבלת הקוד הנכון",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* בסיעתא דשמיא Overlay */}
      <BsiataDishmaya />

      {/* Theme Toggle */}
      <div className="fixed top-4 left-4 z-50">
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* HERO AREA (piano+flute + subtle overlay) */}
        <div className="w-full max-w-5xl rounded-3xl overflow-hidden mb-8 toby-hero toby-frame-glitter">
          <div className="w-full h-full bg-background/60 backdrop-blur-[2px] px-6 py-10 md:px-10 md:py-14 flex flex-col items-center">
            {/* Logo */}
            <div className="mb-6">
              <img
                src={TOBY_LOGO_3D_URL}
                alt="Toby Music Logo"
                className="w-28 h-28 md:w-40 md:h-40 object-contain drop-shadow-2xl"
              />
            </div>

            {/* Welcome */}
            <div className="w-full max-w-2xl">
              <Card className="toby-surface toby-frame-glitter border-0">
                <CardContent className="p-6 text-center">
                  <h1 className="text-2xl md:text-3xl font-bold mb-4 toby-title-glitter">
                    ברוכות הבאות למערכת המוסיקלית של טובי וינברג
                  </h1>
                  <div className="text-sm md:text-base leading-relaxed space-y-1 toby-text">
                    <p>דרך מערכת זו תוכלי לנהל ולהתנהל עם כל הנושאים הטכניים של השיעורים-</p>
                    <p>מערכת השיעורים, החלפות, נתוני תשלומים ועוד.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Login Cards */}
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 mb-8">
          {/* Admin Login */}
          <Card className="toby-surface toby-frame-glitter border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg md:text-xl font-bold toby-subtitle-glitter">
                כניסת מנהל
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div>
                <Label htmlFor="admin-code" className="text-sm font-medium toby-text">
                  קוד מנהל
                </Label>
                <Input
                  id="admin-code"
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="הקש קוד מנהל"
                  className="mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                />
              </div>
              <Button
                onClick={handleAdminLogin}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3"
              >
                כניסה
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Student Login */}
          <Card className="toby-surface toby-frame-glitter border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg md:text-xl font-bold toby-subtitle-glitter">
                אזור אישי
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div>
                <Label htmlFor="student-code" className="text-sm font-medium toby-text">
                  קוד אישי
                </Label>
                <Input
                  id="student-code"
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="הקישי קוד אישי"
                  className="mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()}
                />
              </div>
              <Button
                onClick={handleStudentLogin}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3"
              >
                כניסה לאזור אישי
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contact Details */}
        <Card className="w-full max-w-3xl toby-surface toby-frame-glitter border-0 mb-8">
          <CardContent className="p-6 space-y-3">
            <p className="font-semibold text-lg text-center toby-subtitle-glitter">פרטי קשר:</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 toby-text">
              <Mail className="h-4 w-4 text-primary" />
              <span>תוכלי ליצור קשר גם במייל:</span>
              <a
                href="mailto:toby.musicartist@gmail.com"
                className="hover:text-primary transition-colors font-medium"
              >
                toby.musicartist@gmail.com
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 toby-text">
              <Phone className="h-4 w-4 text-primary" />
              <span>או בנייד:</span>
              <a href="tel:0504124161" className="hover:text-primary transition-colors font-medium">
                0504124161
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 toby-text">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span>כמו כן נשלחות הודעות עידכון גם לווטסאפ הטלפוני:</span>
              <a href="tel:0733837098" className="hover:text-primary transition-colors font-medium">
                0733837098
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card className="w-full max-w-2xl toby-surface toby-frame-glitter border-0 mb-8">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-2xl font-semibold toby-title-glitter">להשתמע!</p>
            <p className="text-xl font-bold toby-text">טובי וינברג</p>
            <p className="italic text-muted-foreground text-lg">איתך, כל הדרך אל המוסיקה</p>
          </CardContent>
        </Card>

        {/* Developer Login */}
        <Card className="w-full max-w-md bg-card/60 backdrop-blur-md border-muted">
          <CardContent className="pt-6 space-y-3">
            <p className="text-xs text-muted-foreground text-center mb-2">כניסת מפתחים</p>
            <Input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="קוד מפתחים"
              className="bg-input border-muted text-foreground text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleDevAdminLogin()}
            />
            <Button
              onClick={handleDevAdminLogin}
              variant="outline"
              className="w-full text-sm border-muted hover:bg-muted/20"
            >
              כניסה למצב מפתחים
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Homepage;

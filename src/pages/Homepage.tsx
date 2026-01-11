import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, GraduationCap, ArrowRight, Mail, Phone, MessageCircle } from 'lucide-react';
import { getStudents, setCurrentUser, setDevMode } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { useAccessMode } from '@/contexts/AccessModeContext';

import content from '@/content/site.he.json';

const Homepage = () => {
  const [adminCode, setAdminCode] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const navigate = useNavigate();
  const { setAccessMode } = useAccessMode();

  const t = content.homepage;

  const handleAdminLogin = async () => {
    if (adminCode === 'toby2026') {
      setDevMode(false);
      sessionStorage.removeItem('musicSystem_devMode');

      setCurrentUser({ type: 'admin', adminCode });
      navigate('/admin');

      toast({
        title: 'ברוך הבא!',
        description: 'התחברת כמנהל מערכת',
      });
    } else {
      toast({
        title: 'שגיאה',
        description: 'קוד מנהל שגוי',
        variant: 'destructive',
      });
    }
  };

  const handleDevAdminLogin = async () => {
    if (adminCode === '1234E') {
      setDevMode(true);
      sessionStorage.setItem('musicSystem_devMode', 'true');

      setCurrentUser({ type: 'admin', adminCode });
      navigate('/dev-admin');

      toast({
        title: '🔧 מצב מפתחים',
        description: 'נכנסת למצב מפתחים מבודד (ללא Worker)',
      });
    } else {
      toast({
        title: 'שגיאה',
        description: 'קוד מפתחים שגוי',
        variant: 'destructive',
      });
    }
  };

  const handleStudentLogin = () => {
    if (!studentCode.trim()) {
      toast({
        title: 'שגיאה',
        description: 'אנא הקישי את הקוד האישי שלך',
        variant: 'destructive',
      });
      return;
    }

    // Check for public mode code
    if (studentCode.trim().toUpperCase() === 'STUDENTS2026') {
      setAccessMode('public');
      setCurrentUser({ type: 'public_view' });
      navigate('/student/public');
      toast({
        title: 'מצב תצוגה כללית',
        description: 'נכנסת למצב צפייה בלבד',
      });
      return;
    }

    const students = getStudents();

    // Try to find by personalCode first
    let student = students.find((s) => s.personalCode === studentCode.trim());

    // Fallback: if personalCode is empty or not found, try phone (backward compatibility)
    if (!student) {
      student = students.find((s) => s.phone === studentCode.trim());
    }

    if (student) {
      setAccessMode('private');
      setCurrentUser({ type: 'student', studentId: student.id });
      navigate(`/student/${student.id}`);
      toast({
        title: 'ברוכה הבאה לאזור האישי!',
        description: `שלום ${student.firstName} ${student.lastName}`,
      });
    } else {
      toast({
        title: 'שגיאה',
        description: 'קוד אישי שגוי. אנא פני למנהלת לקבלת הקוד הנכון',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Royal Static Background */}
      <div className="fixed inset-0 z-0 royal-background">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/20 to-secondary/30"></div>
        <div className="absolute inset-0 shimmer-overlay"></div>
        <div className="absolute inset-0 logo-pattern"></div>
      </div>

      {/* Dark Overlay for Better Contrast */}
      <div className="fixed inset-0 bg-black/30 z-[1]"></div>

      <div className="relative z-10 container mx-auto p-4 space-y-8">
        {/* Header with Logo */}
        <div className="text-center py-12">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <img
                src={t.logo.src}
                alt={t.logo.alt}
                className="h-48 w-48 logo-crown float crown-glow object-contain"
              />
              <div className="absolute inset-0 shimmer rounded-full"></div>
              {/* Decorative sparkles around logo */}
              <div
                className="absolute -top-4 -right-4 w-3 h-3 bg-accent rounded-full sparkle"
                style={{ animationDelay: '0s' }}
              ></div>
              <div
                className="absolute -bottom-2 -left-2 w-2 h-2 bg-secondary rounded-full sparkle"
                style={{ animationDelay: '0.5s' }}
              ></div>
              <div
                className="absolute top-1/2 -right-8 w-4 h-4 bg-accent rounded-full sparkle"
                style={{ animationDelay: '1s' }}
              ></div>
              <div
                className="absolute -top-2 left-1/4 w-2 h-2 bg-secondary rounded-full sparkle"
                style={{ animationDelay: '1.5s' }}
              ></div>
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md rounded-2xl border-2 border-accent/30 max-w-4xl mx-auto mb-8 p-8 shadow-gold">
            <h1 className="text-4xl font-bold text-accent mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
              {t.hero.title}
            </h1>

            <div className="text-lg text-foreground leading-relaxed space-y-3">
              {t.hero.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md rounded-2xl border-2 border-secondary/30 max-w-3xl mx-auto mb-8 p-6 shadow-gold">
            <div className="space-y-3">
              <p className="font-semibold text-secondary text-lg drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                {t.contact.title}
              </p>

              <div className="flex items-center justify-center gap-2 text-foreground">
                <Mail className="h-4 w-4 text-accent" />
                <span>{t.contact.emailLabel}</span>
                <a
                  href={`mailto:${t.contact.email}`}
                  className="hover:text-accent transition-colors font-medium"
                >
                  {t.contact.email}
                </a>
              </div>

              <div className="flex items-center justify-center gap-2 text-foreground">
                <Phone className="h-4 w-4 text-accent" />
                <span>{t.contact.phoneLabel}</span>
                <a
                  href={`tel:${t.contact.phone}`}
                  className="hover:text-accent transition-colors font-medium"
                >
                  {t.contact.phone}
                </a>
              </div>

              <div className="flex items-center justify-center gap-2 text-foreground">
                <MessageCircle className="h-4 w-4 text-accent" />
                <span>{t.contact.whatsappLabel}</span>
                <a
                  href={`tel:${t.contact.whatsapp}`}
                  className="hover:text-accent transition-colors font-medium"
                >
                  {t.contact.whatsapp}
                </a>
              </div>
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md rounded-2xl border-2 border-accent/30 max-w-2xl mx-auto p-6 shadow-gold">
            <div className="space-y-2">
              <p className="text-2xl font-semibold text-accent drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                {t.signature.bye}
              </p>
              <p className="text-xl font-bold text-secondary drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                {t.signature.name}
              </p>
              <p className="italic text-foreground text-lg">{t.signature.slogan}</p>
            </div>
          </div>
        </div>

        {/* Login Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Admin Login */}
          <Card className="relative overflow-hidden bg-black/70 backdrop-blur-md border-2 border-accent/40 hover:border-accent/60 transition-all duration-300 shadow-gold hover:shadow-hover">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'url(/logo-background.png)',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            ></div>
            <CardHeader className="text-center relative z-10">
              <div className="mx-auto mb-4 p-4 bg-primary/20 rounded-full w-fit gold-shadow border border-accent/30">
                <Shield className="h-10 w-10 text-accent drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              </div>
              <CardTitle className="text-xl text-foreground font-bold">{t.cards.admin.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div>
                <Label htmlFor="admin-code" className="text-sm font-medium text-foreground">
                  {t.cards.admin.codeLabel}
                </Label>
                <Input
                  id="admin-code"
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder={t.cards.admin.codePlaceholder}
                  className="mt-1 bg-black/50 border-accent/30 text-foreground placeholder:text-muted-foreground"
                  onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                />
              </div>
              <Button
                onClick={handleAdminLogin}
                className="w-full gold-gradient hover:scale-105 transition-musical text-accent-foreground font-semibold py-3 shadow-gold border border-accent/20"
              >
                {t.cards.admin.buttonText}
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Student Personal Login */}
          <Card className="relative overflow-hidden bg-black/70 backdrop-blur-md border-2 border-accent/40 hover:border-accent/60 transition-all duration-300 shadow-gold hover:shadow-hover">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'url(/logo-background.png)',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            ></div>
            <CardHeader className="text-center relative z-10">
              <div className="mx-auto mb-4 p-4 bg-accent/20 rounded-full w-fit gold-shadow border border-accent/30">
                <GraduationCap className="h-10 w-10 text-accent drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              </div>
              <CardTitle className="text-xl text-foreground font-bold">{t.cards.student.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div>
                <Label htmlFor="student-code" className="text-sm font-medium text-foreground">
                  {t.cards.student.codeLabel}
                </Label>
                <Input
                  id="student-code"
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder={t.cards.student.codePlaceholder}
                  className="mt-1 bg-black/50 border-accent/30 text-foreground placeholder:text-muted-foreground"
                  onKeyPress={(e) => e.key === 'Enter' && handleStudentLogin()}
                />
              </div>
              <Button
                onClick={handleStudentLogin}
                className="w-full gold-gradient hover:scale-105 transition-musical text-accent-foreground font-semibold py-3 shadow-gold border border-accent/20"
              >
                {t.cards.student.buttonText}
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="bg-black/70 backdrop-blur-md border-2 border-accent/30 max-w-5xl mx-auto shadow-gold">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-accent drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
              {t.instructions.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div className="text-center p-6 rounded-lg bg-primary/10 border border-accent/30 hover:bg-primary/20 transition-colors backdrop-blur-sm">
                <p className="text-foreground">
                  <strong className="text-accent text-base drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                    {t.instructions.adminTitle}
                  </strong>
                  <br />
                  {t.instructions.adminText}
                </p>
              </div>
              <div className="text-center p-6 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors backdrop-blur-sm">
                <p className="text-foreground">
                  <strong className="text-accent text-base drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                    {t.instructions.studentTitle}
                  </strong>
                  <br />
                  {t.instructions.studentText}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Developer Login - Bottom of Page */}
        <div className="mt-12 max-w-md mx-auto">
          <Card className="relative overflow-hidden bg-black/60 backdrop-blur-md border border-muted/40 hover:border-muted/60 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/5 to-transparent"></div>
            <CardContent className="pt-6 space-y-3 relative z-10">
              <p className="text-xs text-muted-foreground text-center mb-2">{t.developer.title}</p>
              <div>
                <Input
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder={t.developer.placeholder}
                  className="bg-black/50 border-muted/30 text-foreground text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleDevAdminLogin()}
                />
              </div>
              <Button onClick={handleDevAdminLogin} variant="outline" className="w-full text-sm border-muted/40 hover:bg-muted/10">
                {t.developer.buttonText}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Homepage;

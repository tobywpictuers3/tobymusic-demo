import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  LogOut, Users, Calendar, CreditCard, MessageSquare,
  FileText, Settings, Music, History, Trophy
} from 'lucide-react';
import {
  setCurrentUser, getCurrentUser, clearPracticeAndMedalData, setDevMode
} from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { hybridSync } from '@/lib/hybridSync';
import { PrintPDFButton } from '@/components/ui/print-pdf-button';
import { SaveButton } from '@/components/ui/save-button';
import { UnreadMessagesBadge } from '@/components/ui/unread-messages-badge';
import SyncStatusBadge from '@/components/ui/SyncStatusBadge';
import { clearClientCaches } from '@/lib/cacheManager';
import { ASSETS } from '@/brand/assets';
import BrandSection from '@/components/ui/BrandSection';

import StudentsManagement from '@/components/admin/StudentsManagement';
import LessonJournal from '@/components/admin/LessonJournal';
import PaymentManagement from '@/components/admin/PaymentManagement';
import PerformancesManagement from '@/components/admin/PerformancesManagement';
import BackupImport from '@/components/admin/BackupImport';
import BackupHistory from '@/components/admin/BackupHistory';
import AdminPracticeStats from '@/components/admin/AdminPracticeStats';
import MessagingTab from '@/components/admin/MessagingTab';
import FixedScheduleTab from '@/components/admin/FixedScheduleTab';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const isStorybook =
    typeof window !== 'undefined' && window.location?.port === '6006';

  const [activeTab, setActiveTab] = useState('students');

  // ✅ user ב-state (כדי לא "להיתקע" על null)
  const [user, setUser] = useState<any>(() => {
    const existing = getCurrentUser();
    if (existing) return existing;

    // ✅ ב-Storybook: נתחיל עם admin מדומה כדי שהמסך יעלה
    if (isStorybook) {
      return { id: 'storybook-admin', type: 'admin', name: 'Storybook Admin' } as any;
    }

    return null;
  });

  // 🔒 CRITICAL: Check and restore dev mode on every mount
  useEffect(() => {
    const isDevMode = sessionStorage.getItem('musicSystem_devMode') === 'true';
    if (isDevMode) setDevMode(true);
  }, []);

  // ✅ ב-Storybook: נוודא שגם ה-storage מקבל admin (כדי שילדים/טאבים לא יקרסו)
  useEffect(() => {
    if (!isStorybook) return;

    try {
      const existing = getCurrentUser();
      if (!existing || existing.type !== 'admin') {
        const mockAdmin = { id: 'storybook-admin', type: 'admin', name: 'Storybook Admin' } as any;
        setCurrentUser(mockAdmin);
        setUser(mockAdmin);
      } else {
        setUser(existing);
      }

      sessionStorage.setItem('musicSystem_devMode', 'true');
      setDevMode(true);

      // אם יש לך guards לפי URL:
      window.history.replaceState({}, '', '/admin/default');
    } catch {
      // no-op
    }
  }, [isStorybook]);

  const getTabName = (tab: string) => {
    const tabNames: Record<string, string> = {
      students: 'תלמידות',
      journal: 'יומן שיעורים',
      'fixed-schedule': 'מערכת קבועה',
      payments: 'תשלומים',
      performances: 'הופעות',
      practice: 'נתוני אימונים',
      messages: 'תקשורת',
      backup: 'גיבוי',
      history: 'היסטוריה'
    };
    return tabNames[tab] || 'תצוגה';
  };

  // ✅ Redirect רק בתוך useEffect (לא בזמן render!)
  useEffect(() => {
    if (!user || user.type !== 'admin') {
      if (isStorybook) return; // ב-Storybook לא מפנים
      navigate('/');
    }
  }, [user, isStorybook, navigate]);

  // באתר האמיתי – אם אין admin, לא מציירים כלום (כמו קודם), אבל בלי navigate בזמן render
  if (!user || user.type !== 'admin') {
    return null;
  }

  const handleLogout = async () => {
    await clearClientCaches();
    sessionStorage.removeItem('musicSystem_devMode');
    setDevMode(false);

    setCurrentUser(null);
    setUser(null);

    navigate('/');
    toast({
      title: 'התנתקות מוצלחת',
      description: 'נתראה בפעם הבאה!',
    });
  };

  const handleClearPracticeData = () => {
    const confirmClear = window.confirm(
      '⚠️ האם את בטוחה שברצונך למחוק את כל נתוני האימונים והמדליות?\n\n' +
      'הפעולה תמחק:\n' +
      '✗ כל שיעורי האימון הרשומים\n' +
      '✗ כל ההישגים החודשיים\n' +
      '✗ כל המדליות שנצברו\n\n' +
      'פעולה זו לא ניתנת לביטול!'
    );

    if (confirmClear) {
      try {
        clearPracticeAndMedalData();
        toast({
          title: '✅ הנתונים נמחקו בהצלחה',
          description: 'כל נתוני האימונים והמדליות נמחקו. הדף יתרענן.',
        });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        toast({
          title: '❌ שגיאה במחיקת הנתונים',
          description: 'אירעה תקלה. נסי שוב.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="min-h-screen overflow-hidden relative z-10">
      {/* Sticky Header with title glow */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-background via-background to-background/95 backdrop-blur-sm border-b border-primary/20 shadow-lg">
        <div className="container mx-auto p-4">
          <BrandSection backgroundUrl={ASSETS.backgrounds.red} className="p-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gold title-glow">
                דשבורד ניהול - מערכת שיעורי נגינה
              </h1>
              <div className="flex gap-2 items-center">
                <UnreadMessagesBadge userId="admin" />
                <SyncStatusBadge />
                <div className="relative">
                  <SaveButton />
                  <div className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </div>
                </div>
                <PrintPDFButton contentId="main-content" tabName={getTabName(activeTab)} />
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-gold text-gold hover:bg-gold/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  התנתק
                </Button>
              </div>
            </div>
          </BrandSection>
        </div>
      </div>

      <div className="max-h-screen overflow-y-auto">
        <div id="main-content" className="container mx-auto p-4 space-y-6 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                תלמידות
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                יומן שיעורים
              </TabsTrigger>
              <TabsTrigger value="fixed-schedule" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                מערכת קבועה
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                תשלומים
              </TabsTrigger>
              <TabsTrigger value="performances" className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                הופעות
              </TabsTrigger>
              <TabsTrigger value="practice" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                נתוני אימונים
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                תקשורת
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                גיבוי
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                היסטוריה
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="fade-slide-in">
              <BrandSection backgroundUrl={ASSETS.backgrounds.red}>
                <div className="p-4"><StudentsManagement /></div>
              </BrandSection>
            </TabsContent>

            <TabsContent value="journal" className="fade-slide-in">
              <BrandSection backgroundUrl={ASSETS.backgrounds.gold}>
                <div className="p-4"><LessonJournal /></div>
              </BrandSection>
            </TabsContent>

            <TabsContent value="fixed-schedule" className="fade-slide-in">
              <BrandSection backgroundUrl={ASSETS.backgrounds.ard}>
                <div className="p-4"><FixedScheduleTab /></div>
              </BrandSection>
            </TabsContent>

            <TabsContent value="payments" className="fade-slide-in">
              <BrandSection backgroundUrl={ASSETS.backgrounds.lightGold}>
                <div className="p-4"><PaymentManagement /></div>
              </BrandSection>
            </TabsContent>

            <TabsContent value="performances" className="fade-slide-in">
              <PerformancesManagement />
            </TabsContent>

            <TabsContent value="practice" className="fade-slide-in">
              <AdminPracticeStats />
            </TabsContent>

            <TabsContent value="messages" className="fade-slide-in">
              <MessagingTab />
            </TabsContent>

            <TabsContent value="backup" className="fade-slide-in">
              <div className="space-y-6">
                <div className="rounded-xl border p-6 bg-card">
                  <h2 className="text-xl font-bold text-gold mb-4">ניקוי נתוני אימונים ומדליות</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    לחצי על הכפתור למטה כדי למחוק את כל נתוני האימונים, ההישגים החודשיים והמדליות.
                    פעולה זו תאפשר להתחיל מחדש מנקודת שוויון.
                  </p>
                  <Button onClick={handleClearPracticeData} variant="destructive" className="w-full sm:w-auto">
                    🧹 מחק כל נתוני אימונים ומדליות
                  </Button>
                </div>
                <BackupImport />
              </div>
            </TabsContent>

            <TabsContent value="history" className="fade-slide-in">
              <BackupHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

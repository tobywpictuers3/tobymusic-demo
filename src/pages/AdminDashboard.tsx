
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Calendar, CreditCard, MessageSquare, FileText, Settings, Music, History, Trophy } from 'lucide-react';
import { setCurrentUser, getCurrentUser, clearPracticeAndMedalData, setDevMode } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { hybridSync } from '@/lib/hybridSync';
import { PrintPDFButton } from '@/components/ui/print-pdf-button';
import { SaveButton } from '@/components/ui/save-button';
import { UnreadMessagesBadge } from '@/components/ui/unread-messages-badge';

// Import components
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
  const [activeTab, setActiveTab] = useState('students');

  // 🔒 CRITICAL: Check and restore dev mode on every mount
  useEffect(() => {
    const isDevMode = sessionStorage.getItem('musicSystem_devMode') === 'true';
    if (isDevMode) {
      setDevMode(true);
    }
  }, []);

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

  // Check admin access
  const user = getCurrentUser();
  if (!user || user.type !== 'admin') {
    navigate('/');
    return null;
  }

  const handleLogout = () => {
    // Clear dev mode flag on logout
    sessionStorage.removeItem('musicSystem_devMode');
    setDevMode(false);
    setCurrentUser(null);
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
    <div className="min-h-screen royal-gradient overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-background via-background to-background/95 backdrop-blur-sm border-b border-primary/20 shadow-lg">
        <div className="container mx-auto p-4">
          <div className="royal-card royal-shadow p-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-royal-gold royal-glow">
                דשבורד ניהול - מערכת שיעורי נגינה
              </h1>
              <div className="flex gap-2 items-center">
                <UnreadMessagesBadge userId="admin" />
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
                  className="border-royal-burgundy text-royal-burgundy hover:bg-royal-burgundy hover:text-royal-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  התנתק
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-screen overflow-y-auto">
        <div id="main-content" className="container mx-auto p-4 space-y-6 pt-2">

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-10 royal-card royal-shadow">
              <TabsTrigger value="students" className="flex items-center gap-2 royal-tab">
                <Users className="h-4 w-4" />
                תלמידות
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex items-center gap-2 royal-tab">
                <Calendar className="h-4 w-4" />
                יומן שיעורים
              </TabsTrigger>
              <TabsTrigger value="fixed-schedule" className="flex items-center gap-2 royal-tab">
                <Settings className="h-4 w-4" />
                מערכת קבועה
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2 royal-tab">
                <CreditCard className="h-4 w-4" />
                תשלומים
              </TabsTrigger>
              <TabsTrigger value="performances" className="flex items-center gap-2 royal-tab">
                <Music className="h-4 w-4" />
                הופעות
              </TabsTrigger>
              <TabsTrigger value="practice" className="flex items-center gap-2 royal-tab">
                <Trophy className="h-4 w-4" />
                נתוני אימונים
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2 royal-tab">
                <MessageSquare className="h-4 w-4" />
                תקשורת
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2 royal-tab">
                <FileText className="h-4 w-4" />
                גיבוי
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 royal-tab">
                <History className="h-4 w-4" />
                היסטוריה
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students">
              <StudentsManagement />
            </TabsContent>

            <TabsContent value="journal">
              <LessonJournal />
            </TabsContent>

            <TabsContent value="fixed-schedule">
              <FixedScheduleTab />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentManagement />
            </TabsContent>

          <TabsContent value="performances">
            <PerformancesManagement />
          </TabsContent>

          <TabsContent value="practice">
            <AdminPracticeStats />
          </TabsContent>

          <TabsContent value="messages">
              <MessagingTab />
            </TabsContent>

            <TabsContent value="backup">
              <div className="space-y-6">
                <div className="royal-card royal-shadow p-6">
                  <h2 className="text-xl font-bold text-royal-gold mb-4">ניקוי נתוני אימונים ומדליות</h2>
                  <p className="text-sm text-royal-text mb-4">
                    לחצי על הכפתור למטה כדי למחוק את כל נתוני האימונים, ההישגים החודשיים והמדליות.
                    פעולה זו תאפשר להתחיל מחדש מנקודת שוויון.
                  </p>
                  <Button 
                    onClick={handleClearPracticeData}
                    variant="destructive"
                    className="w-full sm:w-auto"
                  >
                    🧹 מחק כל נתוני אימונים ומדליות
                  </Button>
                </div>
                <BackupImport />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <BackupHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

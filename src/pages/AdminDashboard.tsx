
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Calendar, CreditCard, MessageSquare, FileText, Settings, Music, History } from 'lucide-react';
import { setCurrentUser, getCurrentUser } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { hybridSync } from '@/lib/hybridSync';
import { PrintPDFButton } from '@/components/ui/print-pdf-button';
import { SaveButton } from '@/components/ui/save-button';

// Import components
import StudentsManagement from '@/components/admin/StudentsManagement';
import LessonJournal from '@/components/admin/LessonJournal';
import PaymentManagement from '@/components/admin/PaymentManagement';
import PerformancesManagement from '@/components/admin/PerformancesManagement';
import SwapRequests from '@/components/admin/SwapRequests';
import BackupImport from '@/components/admin/BackupImport';
import BackupHistory from '@/components/admin/BackupHistory';

import FixedScheduleTab from '@/components/admin/FixedScheduleTab';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('students');

  const getTabName = (tab: string) => {
    const tabNames: Record<string, string> = {
      students: 'תלמידות',
      journal: 'יומן שיעורים',
      'fixed-schedule': 'מערכת קבועה',
      payments: 'תשלומים',
      performances: 'הופעות',
      swaps: 'בקשות החלפה',
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
    setCurrentUser(null);
    navigate('/');
    toast({
      title: 'התנתקות מוצלחת',
      description: 'נתראה בפעם הבאה!',
    });
  };

  return (
    <div className="min-h-screen royal-gradient overflow-hidden">
      <div className="max-h-screen overflow-y-auto">
        <div id="main-content" className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="royal-card royal-shadow p-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-royal-gold royal-glow">
                דשבורד ניהול - מערכת שיעורי נגינה
              </h1>
              <div className="flex gap-2">
                <SaveButton />
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

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-8 royal-card royal-shadow">
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
              <TabsTrigger value="swaps" className="flex items-center gap-2 royal-tab">
                <MessageSquare className="h-4 w-4" />
                בקשות החלפה
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

            <TabsContent value="swaps">
              <SwapRequests />
            </TabsContent>

            <TabsContent value="backup">
              <BackupImport />
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

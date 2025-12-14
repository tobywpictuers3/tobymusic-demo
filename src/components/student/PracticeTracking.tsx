import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Label } from '@/components/safe-ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Badge } from '@/components/safe-ui/badge';
import { Play, Square, Clock, Trophy, Sparkles, TrendingUp, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/safe-ui/alert-dialog';
import { addPracticeSession, getStudentPracticeSessions, deletePracticeSession } from '@/lib/storage';
import { PracticeSession } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { CelebrationToast } from './CelebrationToast';
import PracticeLeaderboard from './PracticeLeaderboard';
import MonthlyAchievements from './MonthlyAchievements';
import YearlyAchievements from './YearlyAchievements';
import StreakProgress from './StreakProgress';
import { hybridSync } from '@/lib/hybridSync';
import { 
  getMedalSummary, 
  getDailyMedalLevel, 
  getDailyMedalInfo,
  getNextDailyMedalInfo,
  getCurrentStreak,
  checkForNewDailyMilestone,
  checkForNewStreakMilestone,
} from '@/lib/medalEngine';

interface PracticeTrackingProps {
  studentId: string;
}

interface DailyStats {
  date: string;
  sessions: PracticeSession[];
  totalMinutes: number;
  medalIcon: string;
  medalName: string;
}

const PracticeTracking = ({ studentId }: PracticeTrackingProps) => {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<{ message: string; medal: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadSessions();
  }, [studentId, refreshKey]);

  useEffect(() => {
    calculateDailyStats();
  }, [sessions]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, startTime]);

  const loadSessions = () => {
    const studentSessions = getStudentPracticeSessions(studentId);
    setSessions(studentSessions);
  };

  const calculateDailyStats = () => {
    // Group sessions by date
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, PracticeSession[]>);

    // Calculate stats with derived medals (not stored)
    const stats: DailyStats[] = Object.entries(grouped)
      .map(([date, daySessions]) => {
        const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        
        // Get derived medal for this day
        const level = getDailyMedalLevel(totalMinutes);
        const medalInfo = getDailyMedalInfo(level);

        return { 
          date, 
          sessions: daySessions, 
          totalMinutes,
          medalIcon: medalInfo.icon,
          medalName: medalInfo.name,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyStats(stats);
  };

  const showCelebration = (message: string, medal: string) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347']
    });

    setActiveCelebration({ message, medal });
  };

  const checkAndShowCelebrations = (dateForCheck: string, newMinutes: number) => {
    // Get previous total for this date (before adding new session)
    const existingTotal = sessions
      .filter(s => s.date === dateForCheck)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    const previousMinutes = existingTotal;
    const newTotal = previousMinutes + newMinutes;
    
    // Check for daily milestone
    const dailyMilestone = checkForNewDailyMilestone(previousMinutes, newTotal);
    if (dailyMilestone) {
      showCelebration(dailyMilestone.message, dailyMilestone.medal);
      return;
    }
    
    // Check for streak milestone (only for today's date)
    const today = new Date().toISOString().split('T')[0];
    if (dateForCheck === today) {
      const previousStreak = getCurrentStreak(studentId);
      // After adding session, check if streak increased
      // We need to reload to get accurate count, but for now estimate
      const streakMilestone = checkForNewStreakMilestone(previousStreak - 1, previousStreak);
      if (streakMilestone) {
        showCelebration(streakMilestone.message, streakMilestone.medal);
      }
    }
  };

  const saveWithRetry = async (sessionData: Omit<PracticeSession, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      setIsSaving(true);
      
      // Create unique session hash to prevent duplicates
      const sessionHash = `${sessionData.studentId}-${sessionData.date}-${sessionData.startTime}-${sessionData.endTime}`;
      const existingSessions = getStudentPracticeSessions(studentId);
      
      // Check if session already exists
      const isDuplicate = existingSessions.some(s => 
        `${s.studentId}-${s.date}-${s.startTime}-${s.endTime}` === sessionHash
      );
      
      if (isDuplicate) {
        toast({
          title: '⚠️ אימון כבר קיים',
          description: 'אימון זה כבר נרשם במערכת',
          variant: 'destructive',
          duration: 3000,
        });
        return false;
      }
      
      // Check celebrations before adding (to compare old vs new)
      checkAndShowCelebrations(sessionData.date, sessionData.durationMinutes);
      
      // Add session to local storage
      addPracticeSession(sessionData);
      
      // Try to sync to Dropbox
      const result = await hybridSync.onDataChange();
      
      if (result.synced) {
        toast({
          title: '✅ נשמר בדרופבוקס!',
          description: `${sessionData.durationMinutes} דקות נשמרו בהצלחה`,
          duration: 3000,
        });
      } else if (result.success) {
        toast({
          title: '💾 נשמר מקומית',
          description: 'האימון נשמר. יסונכרן אוטומטית בעוד 2 דקות',
          duration: 4000,
        });
      } else {
        toast({
          title: '❌ שמירה נכשלה',
          description: result.message || 'בדקי חיבור לאינטרנט',
          variant: 'destructive',
          duration: 5000,
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: '❌ שגיאה בשמירה',
        description: 'אנא נסי שוב מאוחר יותר',
        variant: 'destructive',
        duration: 5000,
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
    setElapsedSeconds(0);
    toast({
      title: 'התחלת אימון',
      description: 'בהצלחה! זמן האימון החל להימדד',
    });
  };

  const handleStopTracking = async () => {
    if (!startTime) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    if (durationMinutes < 1) {
      toast({
        title: 'אימון קצר מדי',
        description: 'האימון היה קצר מדקה אחת',
        variant: 'destructive',
      });
      setIsTracking(false);
      setStartTime(null);
      return;
    }

    const sessionData = {
      studentId,
      date: new Date().toISOString().split('T')[0],
      startTime: startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      durationMinutes,
    };

    const saved = await saveWithRetry(sessionData);

    setIsTracking(false);
    setStartTime(null);
    setElapsedSeconds(0);

    if (saved) {
      setRefreshKey(k => k + 1);
    }
  };

  const handleManualEntry = async () => {
    if (!manualStartTime || !manualEndTime || !manualDate) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    const [startHour, startMin] = manualStartTime.split(':').map(Number);
    const [endHour, endMin] = manualEndTime.split(':').map(Number);
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    if (durationMinutes <= 0) {
      toast({
        title: 'שגיאה',
        description: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
        variant: 'destructive',
      });
      return;
    }

    const sessionData = {
      studentId,
      date: manualDate,
      startTime: manualStartTime,
      endTime: manualEndTime,
      durationMinutes,
    };

    const saved = await saveWithRetry(sessionData);

    if (saved) {
      setManualStartTime('');
      setManualEndTime('');
      setManualDate(new Date().toISOString().split('T')[0]);
      setRefreshKey(k => k + 1);
    }
  };

  const getWeeklyTotal = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    return sessions
      .filter(s => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  };

  const calculateDailyAverage = () => {
    const weeklyTotal = getWeeklyTotal();
    return weeklyTotal / 7;
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      deletePracticeSession(sessionId);
      await hybridSync.onDataChange();
      
      setRefreshKey(k => k + 1);
      
      toast({
        title: '✅ נמחק בהצלחה',
        description: 'האימון נמחק מהמערכת',
        duration: 3000,
      });
      
      setSessionToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: '❌ שגיאה במחיקה',
        description: 'אנא נסי שוב',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  // Get today's progress for medal info
  const getTodayProgress = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats.find(d => d.date === today);
    const todayMinutes = todayStats?.totalMinutes || 0;
    return getNextDailyMedalInfo(todayMinutes);
  };

  return (
    <>
      {activeCelebration && (
        <CelebrationToast
          message={activeCelebration.message}
          medal={activeCelebration.medal}
          onClose={() => setActiveCelebration(null)}
        />
      )}
      
      <div className="space-y-6">
      {/* Quick Start/Stop */}
      <Card className="card-gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            מעקב אימונים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {!isTracking ? (
              <Button
                size="lg"
                onClick={handleStartTracking}
                className="hero-gradient"
              >
                <Play className="h-5 w-5 mr-2" />
                התחלת אימון
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Clock className="h-5 w-5 animate-pulse text-primary" />
                    אימון פעיל
                  </div>
                  <div className="text-4xl font-bold text-primary" dir="ltr">
                    {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    דקות:שניות
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStopTracking}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    <>
                      <Square className="h-5 w-5 mr-2" />
                      סיום אימון
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">הזנה ידנית</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="manualDate">תאריך</Label>
                <Input
                  id="manualDate"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="manualStart">שעת התחלה</Label>
                <Input
                  id="manualStart"
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="manualEnd">שעת סיום</Label>
                <Input
                  id="manualEnd"
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleManualEntry} 
                  className="w-full"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    'רישום אימון'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary & Daily Average */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-semibold">סה"כ שבועי:</span>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {getWeeklyTotal()} דקות
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span className="text-lg font-semibold">ממוצע יומי:</span>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {calculateDailyAverage().toFixed(1)} דקות
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {(() => {
                const nextMedalInfo = getTodayProgress();
                
                return nextMedalInfo ? (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">נותרו למדליה הבאה</div>
                    <div className="text-lg font-bold text-primary">
                      {nextMedalInfo.remaining} דקות
                    </div>
                    <div className="text-xs text-muted-foreground">{nextMedalInfo.nextMedal}</div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-green-600 font-semibold">
                    🏆 השגת את כל המדליות היומיות!
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard & Progress */}
      <div className="grid gap-6 md:grid-cols-2">
        <PracticeLeaderboard />
        <StreakProgress studentId={studentId} />
      </div>

      {/* Achievements */}
      <YearlyAchievements studentId={studentId} />
      <MonthlyAchievements studentId={studentId} />

      {/* Daily History */}
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית אימונים</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>אימונים</TableHead>
                <TableHead>סה"כ דקות</TableHead>
                <TableHead>מדליה</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyStats.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">
                    {new Date(day.date).toLocaleDateString('he-IL', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {day.sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between text-sm text-muted-foreground group">
                          <div>
                            {session.startTime && session.endTime && (
                              <span>{session.startTime} - {session.endTime}</span>
                            )}
                            <span className="mr-2">({session.durationMinutes} דק')</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            onClick={() => setSessionToDelete(session.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{day.totalMinutes} דקות</Badge>
                  </TableCell>
                  <TableCell>
                    {day.medalIcon && (
                      <Badge variant="secondary" className="text-xs">
                        {day.medalIcon} {day.medalName}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת אימון</AlertDialogTitle>
            <AlertDialogDescription>
              האם את בטוחה שברצונך למחוק את האימון? פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PracticeTracking;

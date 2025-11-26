import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Trophy, Sparkles, TrendingUp, Loader2, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getPracticeSessions, addPracticeSession, getStudentPracticeSessions, updateMonthlyAchievement, getStudents, getLessons, addMedalRecord, getStudentMedalRecords, deletePracticeSession } from '@/lib/storage';
import { PracticeSession } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { CelebrationToast } from './CelebrationToast';
import PracticeLeaderboard from './PracticeLeaderboard';
import MonthlyAchievements from './MonthlyAchievements';
import YearlyAchievements from './YearlyAchievements';
import StreakProgress from './StreakProgress';
import { hybridSync } from '@/lib/hybridSync';
import { recalcAllForStudent, calculateLessonIntervals } from '@/lib/practiceEngine';

interface PracticeTrackingProps {
  studentId: string;
}

interface DailyStats {
  date: string;
  sessions: PracticeSession[];
  totalMinutes: number;
  medals: string[];
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
  const [shownCongrats, setShownCongrats] = useState<Set<string>>(new Set());
  const [activeCelebration, setActiveCelebration] = useState<{ message: string; medal: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [studentId]);

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
    
    // Recalculate all stats using central engine
    recalcAllForStudent(studentId);
  };

  const calculateDailyStats = () => {
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, PracticeSession[]>);

    const stats: DailyStats[] = Object.entries(grouped)
      .map(([date, daySessions]) => {
        const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const medals: string[] = [];
        const allMedals = getStudentMedalRecords(studentId);
        const dayMedals = allMedals.filter(m => m.earnedDate === date);
        
        // Get current day medals
        dayMedals.forEach(m => {
          if (m.medalType === 'duration') {
            if (m.level === 'platinum') medals.push('💎 פלטינום');
            else if (m.level === 'gold') medals.push('🥇 זהב');
            else if (m.level === 'silver') medals.push('🥈 כסף');
            else if (m.level === 'bronze') medals.push('🥉 נחושת');
          } else if (m.medalType === 'streak') {
            if (m.level === 'streak21') medals.push('👑 רצף ראוי לציון');
            else if (m.level === 'streak14') medals.push('💎 רצף נהדר');
            else if (m.level === 'streak6') medals.push('⚡ מרוצף');
            else if (m.level === 'streak3') medals.push('🔥 רצף');
          }
        });

        return { date, sessions: daySessions, totalMinutes, medals };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyStats(stats);
  };

  const checkStreaks = (stats: DailyStats[]) => {
    if (stats.length === 0) return;

    // Sort by date ascending for streak calculation
    const sorted = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const dates = sorted.map(s => s.date);
    
    // Calculate current streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = currentDate.toISOString().split('T')[0];
      if (dates.includes(checkDate)) {
        streak++;
      } else if (checkDate !== today) {
        // If we missed a day (and it's not today), streak is broken
        break;
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }

    showStreakCongrats(streak);
    
    // Update monthly achievement with max streak
    updateMonthlyAchievement(studentId, { maxStreak: streak });
  };

  const getNextMedalInfo = (totalMinutes: number): { nextMedal: string; remaining: number } | null => {
    if (totalMinutes < 15) return { nextMedal: 'נחושת (15 דקות)', remaining: 15 - totalMinutes };
    if (totalMinutes < 40) return { nextMedal: 'כסף (40 דקות)', remaining: 40 - totalMinutes };
    if (totalMinutes < 150) return { nextMedal: 'זהב (150 דקות)', remaining: 150 - totalMinutes };
    if (totalMinutes < 270) return { nextMedal: 'פלטינום (270 דקות)', remaining: 270 - totalMinutes };
    return null;
  };

  const getNextStreakInfo = (streak: number): { nextMedal: string; remaining: number } | null => {
    const effectiveStreak = streak > 21 ? streak % 21 : streak;
    if (effectiveStreak < 3) return { nextMedal: 'רצף (3 ימים)', remaining: 3 - effectiveStreak };
    if (effectiveStreak < 6) return { nextMedal: 'מרוצף (6 ימים)', remaining: 6 - effectiveStreak };
    if (effectiveStreak < 14) return { nextMedal: 'רצף נהדר (14 ימים)', remaining: 14 - effectiveStreak };
    if (effectiveStreak < 21) return { nextMedal: 'רצף ראוי לציון (21 ימים)', remaining: 21 - effectiveStreak };
    return null;
  };

  const showStreakCongrats = (streak: number) => {
    const existingMedals = getStudentMedalRecords(studentId);
    const today = new Date().toISOString().split('T')[0];
    
    // ✅ Reset streak after 21 days
    const effectiveStreak = streak > 21 ? streak % 21 : streak;
    
    let message = '';
    let medal = '';
    let level: 'streak3' | 'streak6' | 'streak14' | 'streak21' | null = null;
    
    if (effectiveStreak >= 21 || streak === 21) {
      level = 'streak21';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today && m.level === 'streak21');
      if (!hasHigherMedal) {
        message = 'בלתי יאומן! 21 ימים ברצף! מגיעה לך מדליית "רצף ראוי לציון"!';
        medal = '👑';
      }
    } else if (effectiveStreak >= 14) {
      level = 'streak14';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today && (m.level === 'streak21' || m.level === 'streak14'));
      if (!hasHigherMedal) {
        message = 'יוצא מן הכלל! 14 ימים ברצף! מגיעה לך מדליית "רצף נהדר"!';
        medal = '💎';
      }
    } else if (effectiveStreak >= 6) {
      level = 'streak6';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today && (m.level === 'streak21' || m.level === 'streak14' || m.level === 'streak6'));
      if (!hasHigherMedal) {
        message = 'מדהים! 6 ימים ברצף! מגיעה לך מדליית "מרוצף"!';
        medal = '⚡';
      }
    } else if (effectiveStreak >= 3) {
      level = 'streak3';
      const hasAnyStreakMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today);
      if (!hasAnyStreakMedal) {
        message = 'יפה מאוד! 3 ימים ברצף! מגיעה לך מדליית "רצף"!';
        medal = '🔥';
      }
    }

    if (message && level) {
      // Remove lower medals from today
      const medalsToRemove = existingMedals.filter(m => m.medalType === 'streak' && m.earnedDate === today);
      medalsToRemove.forEach(m => {
        const allMedals = getStudentMedalRecords(studentId);
        const filtered = allMedals.filter(medal => medal.id !== m.id);
        localStorage.setItem('musicSystem_medalRecords', JSON.stringify(filtered));
      });
      
      // Add new medal
      addMedalRecord({
        studentId,
        medalType: 'streak',
        level,
        streakDays: effectiveStreak,
        earnedDate: today,
      });
      
      showCelebration(message, medal);
    }
  };

  const showDurationCongrats = (totalMinutes: number, dateForMedal?: string) => {
    const targetDate = dateForMedal || new Date().toISOString().split('T')[0];
    const existingMedals = getStudentMedalRecords(studentId);
    
    let message = '';
    let medal = '';
    let level: 'bronze' | 'silver' | 'gold' | 'platinum' | null = null;
    
    // ✅ NEW LOGIC: 15 → Bronze, 40 → Silver, 150 → Gold, 270 → Platinum
    if (totalMinutes >= 270) {
      level = 'platinum';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === targetDate && m.level === 'platinum');
      if (!hasHigherMedal) {
        message = 'בלתי יאומן! 270 דקות אימון! את אלופה אמיתית! מגיעה לך מדליית פלטינום!';
        medal = '💎';
      }
    } else if (totalMinutes >= 150) {
      level = 'gold';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === targetDate && (m.level === 'platinum' || m.level === 'gold'));
      if (!hasHigherMedal) {
        message = 'יוצא מן הכלל! 150 דקות אימון! מגיעה לך מדליית זהב!';
        medal = '🥇';
      }
    } else if (totalMinutes >= 40) {
      level = 'silver';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === targetDate && (m.level === 'platinum' || m.level === 'gold' || m.level === 'silver'));
      if (!hasHigherMedal) {
        message = 'נפלא! צברת היום 40 דקות אימון. מגיעה לך מדליית כסף!';
        medal = '🥈';
      }
    } else if (totalMinutes >= 15) {
      level = 'bronze';
      const hasAnyDurationMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === targetDate);
      if (!hasAnyDurationMedal) {
        message = 'מצוין! צברת 15 דקות אימון היום! קבלי מדליית נחושת!';
        medal = '🥉';
      }
    }

    if (message && level) {
      // Remove lower medals from the target date
      const medalsToRemove = existingMedals.filter(m => m.medalType === 'duration' && m.earnedDate === targetDate);
      medalsToRemove.forEach(m => {
        const allMedals = getStudentMedalRecords(studentId);
        const filtered = allMedals.filter(medal => medal.id !== m.id);
        localStorage.setItem('musicSystem_medalRecords', JSON.stringify(filtered));
      });
      
      // Add new medal with correct date
      addMedalRecord({
        studentId,
        medalType: 'duration',
        level,
        durationMinutes: totalMinutes,
        earnedDate: targetDate,
      });
      
      showCelebration(message, medal);
    }
    
    // Update monthly achievement with max daily minutes
    updateMonthlyAchievement(studentId, { maxDailyMinutes: totalMinutes });
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
      
      // Add session to local storage
      const session = addPracticeSession(sessionData);
      
      // Try to sync to Dropbox
      const result = await hybridSync.onDataChange();
      
      if (result.synced) {
        // Successfully synced to Dropbox
        toast({
          title: '✅ נשמר בדרופבוקס!',
          description: `${sessionData.durationMinutes} דקות נשמרו בהצלחה`,
          duration: 3000,
        });
      } else if (result.success) {
        // Saved locally but not synced (offline)
        toast({
          title: '💾 נשמר מקומית',
          description: 'האימון נשמר. יסונכרן אוטומטית בעוד 2 דקות',
          duration: 4000,
        });
      } else {
        // Save failed
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
      // Recalculate all stats after adding session
      recalcAllForStudent(studentId);
      loadSessions();
      // Check for duration milestones - for THIS session only, not total
      showDurationCongrats(durationMinutes);
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
      // Recalculate all stats after manual entry
      recalcAllForStudent(studentId);
      
      // Reload sessions and recalculate stats
      const allSessions = getStudentPracticeSessions(studentId);
      const allMedals = getStudentMedalRecords(studentId);
      
      // Group by date
      const grouped = allSessions.reduce((acc, session) => {
        if (!acc[session.date]) acc[session.date] = [];
        acc[session.date].push(session);
        return acc;
      }, {} as Record<string, PracticeSession[]>);
      
      const stats = Object.entries(grouped)
        .map(([date, daySessions]) => {
          const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
          const medals: string[] = [];
          
          allMedals.filter(m => m.earnedDate === date).forEach(m => {
            if (m.medalType === 'duration') {
              if (m.level === 'platinum') medals.push('💎 פלטינום');
              else if (m.level === 'gold') medals.push('🥇 זהב');
              else if (m.level === 'silver') medals.push('🥈 כסף');
              else if (m.level === 'bronze') medals.push('🥉 נחושת');
            } else if (m.medalType === 'streak') {
              if (m.level === 'streak21') medals.push('👑 רצף ראוי לציון');
              else if (m.level === 'streak14') medals.push('💎 רצף נהדר');
              else if (m.level === 'streak6') medals.push('⚡ מרוצף');
              else if (m.level === 'streak3') medals.push('🔥 רצף');
            }
          });
          
          return { date, sessions: daySessions, totalMinutes, medals };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setDailyStats(stats);
      
      setManualStartTime('');
      setManualEndTime('');
      setManualDate(new Date().toISOString().split('T')[0]);
      
      // Award medal for the ENTERED DATE, not today
      showDurationCongrats(durationMinutes, manualDate);
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
    // Use central engine to calculate intervals
    const intervals = calculateLessonIntervals(studentId);
    if (intervals.length === 0) return 0;
    
    // Find max average from all intervals
    const maxAverage = Math.max(...intervals.map(i => i.average));
    
    // Update monthly achievement with the maximum average found
    updateMonthlyAchievement(studentId, { maxDailyAverage: maxAverage });
    
    return maxAverage;
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      deletePracticeSession(sessionId);
      await hybridSync.onDataChange();
      
      // Recalculate all stats after deletion
      recalcAllForStudent(studentId);
      loadSessions();
      
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

  // Recalculate medals and stats for all days - uses central engine
  const recalculateMedalsForAllDays = () => {
    setIsRecalculating(true);
    
    try {
      // Use central engine to recalculate everything
      recalcAllForStudent(studentId);
      
      // Reload sessions to update UI
      loadSessions();
      
      toast({
        title: '✅ מדליות עודכנו בהצלחה!',
        description: 'כל החישובים והמדליות עודכנו',
      });
    } catch (error) {
      console.error('Error recalculating medals:', error);
      toast({
        title: 'שגיאה בעדכון מדליות',
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
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
          {/* Retroactive Medal Calculation Button */}
          <div className="pb-4 border-b">
            <Button
              onClick={recalculateMedalsForAllDays}
              disabled={isRecalculating}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 ml-2 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating ? 'מחשב מדליות...' : 'עדכן מדליות למפרע'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              לחצי כאן אם הזנת אימונים למפרע ולא קיבלת מדליות
            </p>
          </div>
          
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
                const today = new Date().toISOString().split('T')[0];
                const todayStats = dailyStats.find(d => d.date === today);
                const todayMinutes = todayStats?.totalMinutes || 0;
                const nextMedalInfo = getNextMedalInfo(todayMinutes);
                
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
                <TableHead>הישגים</TableHead>
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
                    <div className="flex gap-1">
                      {day.medals.map((medal, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {medal}
                        </Badge>
                      ))}
                    </div>
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

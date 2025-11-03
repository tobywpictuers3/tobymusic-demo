import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Trophy, Sparkles, TrendingUp } from 'lucide-react';
import { getPracticeSessions, addPracticeSession, getStudentPracticeSessions, updateMonthlyAchievement, getStudents, getLessons, addMedalRecord, getStudentMedalRecords } from '@/lib/storage';
import { PracticeSession } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { CelebrationToast } from './CelebrationToast';
import PracticeLeaderboard from './PracticeLeaderboard';
import MonthlyAchievements from './MonthlyAchievements';

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
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [shownCongrats, setShownCongrats] = useState<Set<string>>(new Set());
  const [activeCelebration, setActiveCelebration] = useState<{ message: string; medal: string } | null>(null);

  useEffect(() => {
    loadSessions();
  }, [studentId]);

  useEffect(() => {
    calculateDailyStats();
  }, [sessions]);

  const loadSessions = () => {
    const studentSessions = getStudentPracticeSessions(studentId);
    setSessions(studentSessions);
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
            if (m.level === 'diamond') medals.push('💠 יהלום');
            else if (m.level === 'platinum') medals.push('💎 פלטינום');
            else if (m.level === 'gold') medals.push('🥇 זהב');
            else if (m.level === 'silver') medals.push('🥈 כסף');
            else if (m.level === 'bronze') medals.push('🥉 נחושת');
          } else if (m.medalType === 'streak') {
            if (m.level === 'streak7') medals.push('👑 מרצפת');
            else if (m.level === 'streak5') medals.push('⚡ מרוצף');
            else if (m.level === 'streak3') medals.push('🔥 רצוף');
          }
        });

        return { date, sessions: daySessions, totalMinutes, medals };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyStats(stats);
    checkStreaks(stats);
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
    if (totalMinutes < 60) return { nextMedal: 'זהב (60 דקות)', remaining: 60 - totalMinutes };
    if (totalMinutes < 100) return { nextMedal: 'פלטינום (100 דקות)', remaining: 100 - totalMinutes };
    if (totalMinutes < 150) return { nextMedal: 'יהלום (150 דקות)', remaining: 150 - totalMinutes };
    return null;
  };

  const getNextStreakInfo = (streak: number): { nextMedal: string; remaining: number } | null => {
    if (streak < 3) return { nextMedal: 'רצוף (3 ימים)', remaining: 3 - streak };
    if (streak < 5) return { nextMedal: 'מרוצף (5 ימים)', remaining: 5 - streak };
    if (streak < 7) return { nextMedal: 'מרצפת (7 ימים)', remaining: 7 - streak };
    return null;
  };

  const showStreakCongrats = (streak: number) => {
    const existingMedals = getStudentMedalRecords(studentId);
    const today = new Date().toISOString().split('T')[0];
    
    let message = '';
    let medal = '';
    let level: 'streak3' | 'streak5' | 'streak7' | null = null;
    
    if (streak >= 7) {
      level = 'streak7';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today && (m.level === 'streak7'));
      if (!hasHigherMedal) {
        message = 'וואוווו מהמם! שבוע של אימונים יומיומיים! ככה תוכלי בעזרת השם להגיע רחוק! מגיעה לך מדליית מרצפת!';
        medal = '👑';
      }
    } else if (streak >= 5) {
      level = 'streak5';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today && (m.level === 'streak7' || m.level === 'streak5'));
      if (!hasHigherMedal) {
        message = 'שמתי לב שהתאמנת ברצף 5 ימים. המשיכי כך! מגיעה לך מדליית מרוצף!';
        medal = '⚡';
      }
    } else if (streak >= 3) {
      level = 'streak3';
      const hasAnyStreakMedal = existingMedals.find(m => m.medalType === 'streak' && m.earnedDate === today);
      if (!hasAnyStreakMedal) {
        message = 'שמתי לב שהתאמנת ברצף 3 ימים. המשיכי כך! מגיעה לך מדליית רצוף!';
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
        streakDays: streak,
        earnedDate: today,
      });
      
      showCelebration(message, medal);
    }
  };

  const showDurationCongrats = (totalMinutes: number) => {
    const today = new Date().toISOString().split('T')[0];
    const existingMedals = getStudentMedalRecords(studentId);
    
    let message = '';
    let medal = '';
    let level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null = null;
    
    if (totalMinutes >= 150) {
      level = 'diamond';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === today && m.level === 'diamond');
      if (!hasHigherMedal) {
        message = 'בלתי יאומן! 150 דקות אימון! את אלופה אמיתית! מגיעה לך מדליית יהלום!';
        medal = '💠';
      }
    } else if (totalMinutes >= 100) {
      level = 'platinum';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === today && (m.level === 'diamond' || m.level === 'platinum'));
      if (!hasHigherMedal) {
        message = 'יוצא מן הכלל! 100 דקות אימון! מגיעה לך מדליית פלטינום!';
        medal = '💎';
      }
    } else if (totalMinutes >= 60) {
      level = 'gold';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === today && (m.level === 'diamond' || m.level === 'platinum' || m.level === 'gold'));
      if (!hasHigherMedal) {
        message = 'וואו! צברת היום 60 דקות אימון! את עושה עבודה מצוינת! מגיעה לך מדליית זהב!';
        medal = '🥇';
      }
    } else if (totalMinutes >= 40) {
      level = 'silver';
      const hasHigherMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === today && (m.level === 'diamond' || m.level === 'platinum' || m.level === 'gold' || m.level === 'silver'));
      if (!hasHigherMedal) {
        message = 'נפלא! צברת היום 40 דקות אימון. מגיעה לך מדליית כסף!';
        medal = '🥈';
      }
    } else if (totalMinutes >= 15) {
      level = 'bronze';
      const hasAnyDurationMedal = existingMedals.find(m => m.medalType === 'duration' && m.earnedDate === today);
      if (!hasAnyDurationMedal) {
        message = 'מצוין! צברת 15 דקות אימון היום! את כמובן מוזמנת להתאמן עוד....אבל בינתיים קבלי מדליית נחושת!';
        medal = '🥉';
      }
    }

    if (message && level) {
      // Remove lower medals from today
      const medalsToRemove = existingMedals.filter(m => m.medalType === 'duration' && m.earnedDate === today);
      medalsToRemove.forEach(m => {
        const allMedals = getStudentMedalRecords(studentId);
        const filtered = allMedals.filter(medal => medal.id !== m.id);
        localStorage.setItem('musicSystem_medalRecords', JSON.stringify(filtered));
      });
      
      // Add new medal
      addMedalRecord({
        studentId,
        medalType: 'duration',
        level,
        minutes: totalMinutes,
        earnedDate: today,
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

  const handleStartTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
    toast({
      title: 'התחלת אימון',
      description: 'בהצלחה! זמן האימון החל להימדד',
    });
  };

  const handleStopTracking = () => {
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

    const session = addPracticeSession({
      studentId,
      date: new Date().toISOString().split('T')[0],
      startTime: startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      durationMinutes,
    });

    setIsTracking(false);
    setStartTime(null);
    loadSessions();

    // Check for duration milestones - for THIS session only, not total
    showDurationCongrats(durationMinutes);

    toast({
      title: 'אימון הושלם!',
      description: `נרשמו ${durationMinutes} דקות אימון`,
    });
  };

  const handleManualEntry = () => {
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

    addPracticeSession({
      studentId,
      date: manualDate,
      startTime: manualStartTime,
      endTime: manualEndTime,
      durationMinutes,
    });

    loadSessions();
    setManualStartTime('');
    setManualEndTime('');
    
    // Check for duration milestones - for THIS session only, not total
    showDurationCongrats(durationMinutes);

    toast({
      title: 'אימון נרשם!',
      description: `נרשמו ${durationMinutes} דקות אימון`,
    });
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
    // Get student's lessons to find the period between lessons
    const lessons = getLessons().filter(l => l.studentId === studentId && l.status === 'completed');
    if (lessons.length < 2) return 0;

    // Sort lessons by date
    const sortedLessons = lessons.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Get the last two lessons to define the "week"
    const lastLesson = sortedLessons[sortedLessons.length - 1];
    const previousLesson = sortedLessons[sortedLessons.length - 2];
    
    // Calculate the period: from day after previous lesson to last lesson (inclusive)
    const startDate = new Date(previousLesson.date);
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(lastLesson.date);
    
    // Get practice sessions in this period
    const periodSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
    
    if (periodSessions.length === 0) return 0;
    
    // Calculate total minutes
    const totalMinutes = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    
    // Calculate "practice days" according to the rule:
    // Sunday-Thursday: each day counts as 1 day
    // Friday + Saturday: together count as 1 day
    const practiceDaysSet = new Set<string>();
    periodSessions.forEach(s => {
      const date = new Date(s.date);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        // Friday or Saturday - group them together
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - dayOfWeek);
        practiceDaysSet.add(`weekend-${weekStart.toISOString().split('T')[0]}`);
      } else {
        // Sunday-Thursday - each day separate
        practiceDaysSet.add(s.date);
      }
    });
    
    const practiceDays = practiceDaysSet.size;
    if (practiceDays === 0) return 0;
    
    const average = totalMinutes / practiceDays;
    
    // Update monthly achievement
    updateMonthlyAchievement(studentId, { maxDailyAverage: average });
    
    return average;
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
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 animate-pulse" />
                  אימון פעיל
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStopTracking}
                >
                  <Square className="h-5 w-5 mr-2" />
                  סיום אימון
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
                <Button onClick={handleManualEntry} className="w-full">
                  רישום אימון
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

      {/* Leaderboard */}
      <PracticeLeaderboard />

      {/* Monthly Achievements */}
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
                        <div key={session.id} className="text-sm text-muted-foreground">
                          {session.startTime && session.endTime && (
                            <span>{session.startTime} - {session.endTime}</span>
                          )}
                          <span className="mr-2">({session.durationMinutes} דק')</span>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </>
  );
};

export default PracticeTracking;

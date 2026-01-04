import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Target, Flame } from 'lucide-react';
import { getStudentPracticeSessions } from '@/lib/storage';
import { getCurrentStreak, getNextDailyMedalInfo, getNextStreakMedalInfo } from '@/lib/medalEngine';
import { useEffect, useState } from 'react';

interface PracticeStatsRowProps {
  studentId: string;
}

const PracticeStatsRow = ({ studentId }: PracticeStatsRowProps) => {
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [minutesToNextMedal, setMinutesToNextMedal] = useState<{ remaining: number; nextMedal: string } | null>(null);
  const [streakToNextMedal, setStreakToNextMedal] = useState<{ remaining: number; nextMedal: string } | null>(null);

  useEffect(() => {
    const sessions = getStudentPracticeSessions(studentId);
    
    // Rolling 7 days: D-7 00:00 to D-1 23:59 (today not included)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Calculate D-7 and D-1
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 1);
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    
    const d1Str = d1.toISOString().split('T')[0];
    const d7Str = d7.toISOString().split('T')[0];
    
    // Sum minutes in rolling 7 days window
    const rolling7Days = sessions
      .filter(s => s.date >= d7Str && s.date <= d1Str)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    setWeeklyTotal(rolling7Days);
    
    // Daily average for rolling 7 days
    setDailyAverage(rolling7Days / 7);
    
    // Today's minutes for next medal calculation
    const todayMinutes = sessions
      .filter(s => s.date === todayStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    const nextMedalInfo = getNextDailyMedalInfo(todayMinutes);
    setMinutesToNextMedal(nextMedalInfo);
    
    // Streak info
    const currentStreak = getCurrentStreak(studentId);
    const nextStreakInfo = getNextStreakMedalInfo(currentStreak);
    setStreakToNextMedal(nextStreakInfo);
  }, [studentId]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Rolling 7 days total */}
      <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-muted-foreground">סה"כ שבועי</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{weeklyTotal}</div>
          <div className="text-xs text-muted-foreground">דקות ב-7 ימים</div>
        </CardContent>
      </Card>

      {/* Daily average */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-muted-foreground">ממוצע יומי</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{dailyAverage.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">דקות ליום</div>
        </CardContent>
      </Card>

      {/* Minutes to next medal */}
      <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-muted-foreground">למדליה הבאה</span>
          </div>
          {minutesToNextMedal ? (
            <>
              <div className="text-2xl font-bold text-purple-600">{minutesToNextMedal.remaining}</div>
              <div className="text-xs text-muted-foreground truncate">{minutesToNextMedal.nextMedal}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-green-600">🏆</div>
              <div className="text-xs text-muted-foreground">כל המדליות היום!</div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Streak to next medal */}
      <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-muted-foreground">רצף למדליה</span>
          </div>
          {streakToNextMedal ? (
            <>
              <div className="text-2xl font-bold text-orange-600">{streakToNextMedal.remaining}</div>
              <div className="text-xs text-muted-foreground truncate">{streakToNextMedal.nextMedal}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-green-600">🔥</div>
              <div className="text-xs text-muted-foreground">מקסימום רצף!</div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeStatsRow;

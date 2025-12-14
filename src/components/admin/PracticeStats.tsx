import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { getMedalSummary, getCurrentStreak, getDailyMedalLevel, getStreakMedalLevel } from '@/lib/medalEngine';
import { getStudentPracticeSessions } from '@/lib/storage';

interface PracticeStatsProps {
  studentId: string;
}

const PracticeStats = ({ studentId }: PracticeStatsProps) => {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    // Calculate weekly minutes from practice sessions
    const sessions = getStudentPracticeSessions(studentId);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    const weeklyTotal = sessions
      .filter(s => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    setWeeklyMinutes(Math.round(weeklyTotal / 7)); // Daily average

    // Get medal summary (derived, not stored)
    const summary = getMedalSummary(studentId);
    const allMedals: string[] = [];

    // Find best daily medal and best streak
    const bestDailyMedal = summary.dailyMedals.reduce((best, m) => {
      if (!m.level) return best;
      if (!best) return m;
      const levels = ['bronze', 'silver', 'gold', 'platinum'];
      return levels.indexOf(m.level) > levels.indexOf(best.level!) ? m : best;
    }, null as typeof summary.dailyMedals[0] | null);

    const bestStreakMedal = summary.streakMedals.reduce((best, m) => {
      if (!m.level) return best;
      if (!best) return m;
      const levels = ['bronze', 'silver', 'gold', 'platinum'];
      return levels.indexOf(m.level) > levels.indexOf(best.level!) ? m : best;
    }, null as typeof summary.streakMedals[0] | null);

    // Current streak badge
    const currentStreak = getCurrentStreak(studentId);
    if (currentStreak >= 4) {
      const level = getStreakMedalLevel(currentStreak);
      if (level === 'platinum') allMedals.push('👑 רצף פלטינום');
      else if (level === 'gold') allMedals.push('🟡 רצף זהב');
      else if (level === 'silver') allMedals.push('⚪ רצף כסף');
      else if (level === 'bronze') allMedals.push('🔥 רצף נחושת');
    }

    // Best daily badge using new thresholds
    if (bestDailyMedal && bestDailyMedal.level) {
      if (bestDailyMedal.level === 'platinum') allMedals.push('🔵 180+ דק\' ביום');
      else if (bestDailyMedal.level === 'gold') allMedals.push('🟡 80+ דק\' ביום');
      else if (bestDailyMedal.level === 'silver') allMedals.push('⚪ 45+ דק\' ביום');
      else if (bestDailyMedal.level === 'bronze') allMedals.push('🟤 20+ דק\' ביום');
    }

    setMedals(allMedals);
  }, [studentId]);

  if (weeklyMinutes === 0 && medals.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {weeklyMinutes > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          {weeklyMinutes} דק' ממוצע יומי
        </Badge>
      )}
      {medals.map((medal, idx) => (
        <Badge key={idx} variant="secondary" className="text-xs">
          {medal}
        </Badge>
      ))}
    </div>
  );
};

export default PracticeStats;

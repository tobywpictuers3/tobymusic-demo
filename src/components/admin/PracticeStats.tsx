import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { getStudentStatistics } from '@/lib/storage';
import { recalcAllForStudent } from '@/lib/practiceEngine';

interface PracticeStatsProps {
  studentId: string;
}

const PracticeStats = ({ studentId }: PracticeStatsProps) => {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    // Get all statistics from cache or recalculate
    const cached = getStudentStatistics(studentId);
    let weeklyAvg: number;
    let maxStreak: number;
    let maxDaily: number;

    if (cached) {
      weeklyAvg = cached.weeklyAverage ?? 0;
      maxStreak = cached.streak;
      maxDaily = cached.maxDaily;
    } else {
      const stats = recalcAllForStudent(studentId);
      weeklyAvg = stats.weeklyAverage;
      maxStreak = stats.streak;
      maxDaily = stats.maxDaily;
    }

    setWeeklyMinutes(weeklyAvg);

    // Calculate medals based on cached values - NEW LOGIC
    const allMedals: string[] = [];
    
    // Streak medals - new thresholds
    if (maxStreak >= 21) allMedals.push('👑 רצף ראוי לציון');
    else if (maxStreak >= 14) allMedals.push('💎 רצף נהדר');
    else if (maxStreak >= 6) allMedals.push('⚡ מרוצף');
    else if (maxStreak >= 3) allMedals.push('🔥 רצף');

    // Daily medals - new thresholds
    if (maxDaily >= 270) allMedals.push('💎 270 דק\' ביום');
    else if (maxDaily >= 150) allMedals.push('🥇 150 דק\' ביום');
    else if (maxDaily >= 40) allMedals.push('🥈 40 דק\' ביום');
    else if (maxDaily >= 15) allMedals.push('🥉 15 דק\' ביום');

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
          {weeklyMinutes} דק' שבועי
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

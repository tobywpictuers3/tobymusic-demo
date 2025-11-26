import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { getStudentPracticeSessions, getStudentStatistics } from '@/lib/storage';
import { recalcAllForStudent } from '@/lib/practiceEngine';

interface PracticeStatsProps {
  studentId: string;
}

const PracticeStats = ({ studentId }: PracticeStatsProps) => {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    const sessions = getStudentPracticeSessions(studentId);
    
    // Calculate weekly total (last 7 days) - real-time calculation
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    const weeklyTotal = sessions
      .filter(s => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    setWeeklyMinutes(weeklyTotal);

    // Streak and maxDaily from cache
    const cached = getStudentStatistics(studentId);
    let maxStreak: number;
    let maxDaily: number;

    if (cached) {
      maxStreak = cached.streak;
      maxDaily = cached.maxDaily;
    } else {
      const stats = recalcAllForStudent(studentId);
      maxStreak = stats.streak;
      maxDaily = stats.maxDaily;
    }

    // Calculate medals based on cached values
    const allMedals: string[] = [];
    
    if (maxStreak >= 7) allMedals.push('🥇 שבוע רצוף');
    else if (maxStreak >= 6) allMedals.push('🥈 6 ימים רצופים');
    else if (maxStreak >= 3) allMedals.push('🥉 ' + maxStreak + ' ימים רצופים');

    if (maxDaily >= 60) allMedals.push('🥇 60 דק\' ביום');
    else if (maxDaily >= 30) allMedals.push('🥈 30 דק\' ביום');
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

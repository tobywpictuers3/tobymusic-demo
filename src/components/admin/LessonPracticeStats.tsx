import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { Lesson } from '@/lib/types';
import { getStudentStatistics } from '@/lib/storage';
import { recalcAllForStudent } from '@/lib/practiceEngine';

interface LessonPracticeStatsProps {
  studentId: string;
  lesson: Lesson;
}

const LessonPracticeStats = ({ studentId, lesson }: LessonPracticeStatsProps) => {
  const [practiceMinutes, setPracticeMinutes] = useState(0);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    const cached = getStudentStatistics(studentId);
    let intervals: any[];

    if (cached?.intervals) {
      intervals = cached.intervals;
    } else {
      const stats = recalcAllForStudent(studentId);
      intervals = stats.intervals;
    }

    const interval = intervals.find(i => i.lessonId === lesson.id);
    
    if (!interval) {
      setPracticeMinutes(0);
      setDailyAverage(0);
      setMedals([]);
      return;
    }

    setPracticeMinutes(interval.totalMinutes);
    setDailyAverage(interval.average);
    setMedals([]);
  }, [studentId, lesson.id]);

  if (practiceMinutes === 0 && dailyAverage === 0 && medals.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {practiceMinutes > 0 && (
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Trophy className="h-3 w-3" />
          {practiceMinutes} דק'
        </Badge>
      )}
      {dailyAverage > 0 && (
        <Badge variant="secondary" className="text-xs">
          {dailyAverage.toFixed(1)} דק' ממוצע יומי
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

export default LessonPracticeStats;

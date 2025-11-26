import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { Lesson } from '@/lib/types';
import { calculateLessonIntervals } from '@/lib/practiceEngine';

interface LessonPracticeStatsProps {
  studentId: string;
  lesson: Lesson;
}

const LessonPracticeStats = ({ studentId, lesson }: LessonPracticeStatsProps) => {
  const [practiceMinutes, setPracticeMinutes] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    const intervals = calculateLessonIntervals(studentId);
    const interval = intervals.find(i => i.lessonId === lesson.id);
    
    if (!interval) {
      setPracticeMinutes(0);
      setMedals([]);
      return;
    }

    setPracticeMinutes(interval.totalMinutes);
    setMedals([]);
  }, [studentId, lesson.id]);

  if (practiceMinutes === 0 && medals.length === 0) {
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
      {medals.map((medal, idx) => (
        <Badge key={idx} variant="secondary" className="text-xs">
          {medal}
        </Badge>
      ))}
    </div>
  );
};

export default LessonPracticeStats;

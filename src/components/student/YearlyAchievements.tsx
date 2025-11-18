import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar } from 'lucide-react';
import { getStudentPracticeSessions, getLessons } from '@/lib/storage';
import { useEffect, useState } from 'react';

interface YearlyAchievementsProps {
  studentId: string;
}

interface YearlyStats {
  year: string; // e.g., "2024-2025"
  maxDailyAverage: number;
}

const YearlyAchievements = ({ studentId }: YearlyAchievementsProps) => {
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);

  useEffect(() => {
    calculateYearlyStats();
  }, [studentId]);

  const calculateYearlyStats = () => {
    const sessions = getStudentPracticeSessions(studentId);
    const lessons = getLessons().filter(l => l.studentId === studentId && l.status === 'completed');

    if (lessons.length === 0) {
      setYearlyStats([]);
      return;
    }

    // Group by academic year (Sept-Aug)
    const yearlyData: Record<string, { sessions: typeof sessions; lessons: typeof lessons }> = {};

    sessions.forEach(session => {
      const date = new Date(session.date);
      const month = date.getMonth(); // 0-11
      const year = date.getFullYear();
      
      // Academic year: Sept (8) - Aug (7)
      const academicYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      
      if (!yearlyData[academicYear]) {
        yearlyData[academicYear] = { sessions: [], lessons: [] };
      }
      yearlyData[academicYear].sessions.push(session);
    });

    lessons.forEach(lesson => {
      const date = new Date(lesson.date);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const academicYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      
      if (yearlyData[academicYear]) {
        yearlyData[academicYear].lessons.push(lesson);
      }
    });

    // Calculate max daily average for each year
    const stats: YearlyStats[] = Object.entries(yearlyData).map(([year, data]) => {
      const sortedLessons = data.lessons.sort((a, b) => a.date.localeCompare(b.date));
      let maxAverage = 0;

      for (let i = 0; i < sortedLessons.length; i++) {
        const currentLesson = sortedLessons[i];
        const nextLesson = sortedLessons[i + 1];

        if (!nextLesson) continue;

        const start = new Date(currentLesson.date);
        const end = new Date(nextLesson.date);
        const daysBetween = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        const intervalSessions = data.sessions.filter(s => s.date >= currentLesson.date && s.date < nextLesson.date);
        const totalMinutes = intervalSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const average = totalMinutes / daysBetween;

        maxAverage = Math.max(maxAverage, average);
      }

      return { year, maxDailyAverage: maxAverage };
    }).sort((a, b) => b.year.localeCompare(a.year));

    setYearlyStats(stats);
  };

  if (yearlyStats.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          הישגים שנתיים (שנות לימודים)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {yearlyStats.map((stat) => (
            <div
              key={stat.year}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    שנת לימודים {stat.year}
                  </h3>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">ממוצע יומי מקסימלי</div>
                  <div className="text-xl font-bold text-blue-600">
                    {stat.maxDailyAverage.toFixed(1)} דק'
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default YearlyAchievements;

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStudentStatistics } from '@/lib/storage';
import { recalcAllForStudent } from '@/lib/practiceEngine';

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
    // Try to read from cache first
    const cached = getStudentStatistics(studentId);
    
    if (cached?.yearly) {
      setYearlyStats(cached.yearly);
    } else {
      // No cache - recalculate
      const stats = recalcAllForStudent(studentId);
      setYearlyStats(stats.yearly);
    }
  }, [studentId]);

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

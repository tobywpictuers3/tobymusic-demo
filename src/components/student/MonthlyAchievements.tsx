import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Flame, Clock } from 'lucide-react';
import { getStudentPracticeSessions } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { PracticeSession } from '@/lib/types';

interface MonthlyAchievementsProps {
  studentId: string;
}

interface MonthData {
  month: string;
  totalMinutes: number;
  maxDailyMinutes: number;
  maxStreak: number;
}

const MonthlyAchievements = ({ studentId }: MonthlyAchievementsProps) => {
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);

  useEffect(() => {
    const sessions = getStudentPracticeSessions(studentId);
    
    // Group sessions by month
    const byMonth: Record<string, PracticeSession[]> = {};
    sessions.forEach(s => {
      const month = s.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(s);
    });

    // Calculate stats for each month
    const data: MonthData[] = Object.entries(byMonth).map(([month, monthSessions]) => {
      // Total minutes
      const totalMinutes = monthSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      
      // Group by day for daily stats
      const byDay: Record<string, number> = {};
      monthSessions.forEach(s => {
        byDay[s.date] = (byDay[s.date] || 0) + s.durationMinutes;
      });
      
      // Max daily minutes
      const maxDailyMinutes = Math.max(...Object.values(byDay), 0);
      
      // Max streak within month
      const sortedDates = Object.keys(byDay).sort();
      let maxStreak = 0;
      let currentStreak = 0;
      let prevDate: Date | null = null;
      
      for (const dateStr of sortedDates) {
        const date = new Date(dateStr);
        if (prevDate) {
          const diffDays = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        maxStreak = Math.max(maxStreak, currentStreak);
        prevDate = date;
      }
      
      return { month, totalMinutes, maxDailyMinutes, maxStreak };
    });

    // Sort by month descending, exclude current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    setMonthlyData(
      data
        .filter(d => d.month < currentMonth)
        .sort((a, b) => b.month.localeCompare(a.month))
    );
  }, [studentId]);

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  };

  if (monthlyData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          הישגי חודשים קודמים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {monthlyData.map((data) => (
            <div
              key={data.month}
              className="p-3 rounded-lg border border-border bg-gradient-to-br from-background to-muted/30"
            >
              <div className="font-semibold text-base mb-3 text-primary">
                {formatMonth(data.month)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-background/80 rounded">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                  <div className="text-lg font-bold text-purple-600">{data.totalMinutes}</div>
                  <div className="text-xs text-muted-foreground">סה"כ דק'</div>
                </div>
                <div className="p-2 bg-background/80 rounded">
                  <Trophy className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <div className="text-lg font-bold text-green-600">{data.maxDailyMinutes}</div>
                  <div className="text-xs text-muted-foreground">שיא יומי</div>
                </div>
                <div className="p-2 bg-background/80 rounded">
                  <Flame className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                  <div className="text-lg font-bold text-orange-600">{data.maxStreak}</div>
                  <div className="text-xs text-muted-foreground">רצף מקס'</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyAchievements;

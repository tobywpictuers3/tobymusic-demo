import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp } from 'lucide-react';
import { getStudentMonthlyAchievements, getStudentStatistics } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { MonthlyAchievement } from '@/lib/types';
import { recalcAllForStudent } from '@/lib/practiceEngine';

interface MonthlyAchievementsProps {
  studentId: string;
}

const MonthlyAchievements = ({ studentId }: MonthlyAchievementsProps) => {
  const [achievements, setAchievements] = useState<MonthlyAchievement[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const cached = getStudentStatistics(studentId);
    
    if (cached?.monthly) {
      // Convert cached monthly to display format
      const totals: Record<string, number> = {};
      Object.entries(cached.monthly).forEach(([month, data]: [string, any]) => {
        totals[month] = data.total;
      });
      setMonthlyTotals(totals);
    } else {
      const stats = recalcAllForStudent(studentId);
      const totals: Record<string, number> = {};
      Object.entries(stats.monthly).forEach(([month, data]: [string, any]) => {
        totals[month] = data.total;
      });
      setMonthlyTotals(totals);
    }

    // Load saved achievements from storage
    const data = getStudentMonthlyAchievements(studentId);
    setAchievements(data.sort((a, b) => b.month.localeCompare(a.month)));
  }, [studentId]);

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  };

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          הישגי חודשים קודמים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {achievements.length > 0 ? (
          <div className="space-y-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border ${
                  achievement.month === currentMonth
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    {formatMonth(achievement.month)}
                    {achievement.month === currentMonth && (
                      <Badge variant="default" className="text-xs">פעיל</Badge>
                    )}
                  </h3>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">סכום כולל</div>
                    <div className="text-lg font-bold text-purple-600">
                      {monthlyTotals[achievement.month] || 0} דק'
                    </div>
                  </div>
                  <div className="text-center p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">מקסימום יומי</div>
                    <div className="text-lg font-bold text-green-600">
                      {achievement.maxDailyMinutes} דק'
                    </div>
                  </div>
                  <div className="text-center p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">רצף מקסימלי</div>
                    <div className="text-lg font-bold text-orange-600">
                      {achievement.maxStreak} ימים
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            עדיין אין הישגים שנרשמו. המשיכי להתאמן!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyAchievements;

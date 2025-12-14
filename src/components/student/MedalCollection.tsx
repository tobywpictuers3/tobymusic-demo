import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Target, Award, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import { 
  getMedalSummary, 
  MedalSummary, 
  DailyMedal, 
  StreakMedal,
  getDailyMedalInfo,
  getStreakMedalInfo,
} from '@/lib/medalEngine';

interface MedalCollectionProps {
  studentId: string;
}

const MedalCollection = ({ studentId }: MedalCollectionProps) => {
  const [summary, setSummary] = useState<MedalSummary | null>(null);

  useEffect(() => {
    // Derive medals from practice history (not stored)
    const medalSummary = getMedalSummary(studentId);
    setSummary(medalSummary);
  }, [studentId]);

  if (!summary) return null;

  const { dailyMedals, streakMedals, currentStreak, totalBronze, totalSilver, totalGold, totalPlatinum } = summary;
  
  // Filter medals that actually have a level
  const earnedDailyMedals = dailyMedals.filter(m => m.level !== null);
  const earnedStreakMedals = streakMedals.filter(m => m.level !== null);
  
  const totalMedals = totalBronze + totalSilver + totalGold + totalPlatinum;

  // Group daily medals by month for display
  const groupedByMonth = earnedDailyMedals.reduce((acc, medal) => {
    const month = medal.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(medal);
    return acc;
  }, {} as Record<string, DailyMedal[]>);

  const formatMonth = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6">
      {/* Best Achievements Card - Summary */}
      <Card className="bg-gradient-to-br from-yellow-100 via-amber-100 to-yellow-200 dark:from-yellow-800/40 dark:via-amber-800/40 dark:to-yellow-700/40 border-2 border-yellow-500/50 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-black dark:text-yellow-200">
            <Award className="h-6 w-6 text-yellow-700 dark:text-yellow-400" />
            סיכום הישגים
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white/60 dark:bg-black/30 rounded-lg">
            <div className="text-3xl mb-2">🔵</div>
            <div className="text-2xl font-bold text-black dark:text-white">{totalPlatinum}</div>
            <div className="text-sm text-black/70 dark:text-white/70">פלטינום</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-black/30 rounded-lg">
            <div className="text-3xl mb-2">🟡</div>
            <div className="text-2xl font-bold text-black dark:text-white">{totalGold}</div>
            <div className="text-sm text-black/70 dark:text-white/70">זהב</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-black/30 rounded-lg">
            <div className="text-3xl mb-2">⚪</div>
            <div className="text-2xl font-bold text-black dark:text-white">{totalSilver}</div>
            <div className="text-sm text-black/70 dark:text-white/70">כסף</div>
          </div>
          <div className="text-center p-4 bg-white/60 dark:bg-black/30 rounded-lg">
            <div className="text-3xl mb-2">🟤</div>
            <div className="text-2xl font-bold text-black dark:text-white">{totalBronze}</div>
            <div className="text-sm text-black/70 dark:text-white/70">נחושת</div>
          </div>
        </CardContent>
      </Card>

      {/* Current Streak */}
      {currentStreak > 0 && (
        <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Flame className="h-10 w-10 text-orange-500" />
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{currentStreak} ימים</div>
                <div className="text-sm text-muted-foreground">רצף נוכחי</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak Medals */}
      {earnedStreakMedals.length > 0 && (
        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-900/20 via-red-900/20 to-orange-900/20 border-2 border-orange-400/50">
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center gap-2 text-xl text-orange-300">
              <Flame className="h-5 w-5 text-orange-400" />
              מדליות רצף
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {earnedStreakMedals.map((medal, idx) => (
                <div
                  key={`streak-${idx}`}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all hover:scale-105 ${
                    medal.isActive 
                      ? 'bg-orange-500/20 border-orange-400 shadow-lg shadow-orange-500/20' 
                      : 'bg-orange-900/30 border-orange-600/50 hover:border-orange-400'
                  }`}
                >
                  <span className="text-4xl drop-shadow-lg mb-2">{medal.icon}</span>
                  <div className="text-center">
                    <div className="font-medium text-orange-100 text-sm mb-1">
                      {medal.name}
                    </div>
                    <div className="text-xs text-orange-300/80 mb-1">
                      {medal.length} ימים רצופים
                    </div>
                    <div className="text-xs text-orange-300/60">
                      {formatDate(medal.startDate)} - {formatDate(medal.endDate)}
                    </div>
                    {medal.isActive && (
                      <Badge className="mt-2 bg-orange-500 text-white text-xs">
                        פעיל
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Medals Collection */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black border-2 border-yellow-400">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.15),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,rgba(255,215,0,0.3)_49%,rgba(255,215,0,0.3)_51%,transparent_52%)] bg-[length:20px_20px] opacity-20" />
        
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2 text-2xl bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent">
            <Trophy className="h-6 w-6 text-yellow-400" />
            מדליות יומיות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          {Object.entries(groupedByMonth).length > 0 ? (
            Object.entries(groupedByMonth)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([month, monthMedals]) => (
                <div key={month} className="space-y-3">
                  <h3 className="font-semibold text-lg bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                    {formatMonth(month)}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {monthMedals.map((medal, idx) => (
                      <div
                        key={`${medal.date}-${idx}`}
                        className="flex flex-col items-center justify-center p-4 rounded-lg bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 hover:border-yellow-400 transition-all hover:shadow-lg hover:shadow-yellow-500/20 hover:scale-105"
                      >
                        <span className="text-5xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)] mb-2">{medal.icon}</span>
                        <div className="text-center">
                          <div className="font-medium text-yellow-100 text-sm mb-1">
                            {medal.name}
                          </div>
                          <div className="text-xs text-yellow-300/80 mb-1">
                            {medal.totalMinutes} דקות
                          </div>
                          <div className="text-xs text-yellow-300/60">
                            {formatDate(medal.date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-center py-8 text-yellow-200/60">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20 text-yellow-400" />
              <p>עדיין אין מדליות. המשיכי להתאמן כדי לזכות במדליות!</p>
              <p className="text-sm mt-2">20 דקות = נחושת | 45 דקות = כסף | 80 דקות = זהב | 180 דקות = פלטינום</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedalCollection;

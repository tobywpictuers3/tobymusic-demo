import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Clock, Target, Calendar, TrendingUp } from 'lucide-react';
import { getYearlyLeaderboard } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { YearlyLeaderboardEntry } from '@/lib/types';
import { formatPriceCompact } from '@/lib/storeCurrency';

const CompactLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<YearlyLeaderboardEntry[]>([]);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboard = () => {
    setLeaderboard(getYearlyLeaderboard());
  };

  const getMedalEmoji = (position: number) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return '⭐';
  };

  // Prepare all 6 categories
  const categories = [
    {
      key: 'maxDailyYearly',
      title: 'שיא יומי שנתי',
      icon: <Clock className="h-4 w-4" />,
      color: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/40',
      textColor: 'text-green-400',
      entries: [...leaderboard]
        .filter(e => e.maxDailyMinutesYearly > 0)
        .sort((a, b) => b.maxDailyMinutesYearly - a.maxDailyMinutesYearly)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.maxDailyMinutesYearly,
      format: (v: number) => `${v} דק'`,
    },
    {
      key: 'streakYearly',
      title: 'רצף שנתי',
      icon: <Flame className="h-4 w-4" />,
      color: 'from-orange-500/20 to-red-500/20',
      borderColor: 'border-orange-500/40',
      textColor: 'text-orange-400',
      entries: [...leaderboard]
        .filter(e => e.maxStreakYearly > 0)
        .sort((a, b) => b.maxStreakYearly - a.maxStreakYearly)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.maxStreakYearly,
      format: (v: number) => `${v} ימים`,
    },
    {
      key: 'avgBetweenLessons',
      title: 'ממוצע שבועי',
      icon: <Target className="h-4 w-4" />,
      color: 'from-blue-500/20 to-indigo-500/20',
      borderColor: 'border-blue-500/40',
      textColor: 'text-blue-400',
      entries: [...leaderboard]
        .filter(e => e.maxAvgBetweenLessons > 0)
        .sort((a, b) => b.maxAvgBetweenLessons - a.maxAvgBetweenLessons)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.maxAvgBetweenLessons,
      format: (v: number) => `${v.toFixed(1)} דק'`,
    },
    {
      key: 'maxDailyWeekly',
      title: 'שיא יומי השבוע',
      icon: <Calendar className="h-4 w-4" />,
      color: 'from-cyan-500/20 to-sky-500/20',
      borderColor: 'border-cyan-500/40',
      textColor: 'text-cyan-400',
      entries: [...leaderboard]
        .filter(e => e.maxDailyMinutesWeekly > 0)
        .sort((a, b) => b.maxDailyMinutesWeekly - a.maxDailyMinutesWeekly)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.maxDailyMinutesWeekly,
      format: (v: number) => `${v} דק'`,
    },
    {
      key: 'rolling7Days',
      title: '7 ימים מתגלגלים',
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'from-pink-500/20 to-rose-500/20',
      borderColor: 'border-pink-500/40',
      textColor: 'text-pink-400',
      entries: [...leaderboard]
        .filter(e => e.rolling7DaysTotal > 0)
        .sort((a, b) => b.rolling7DaysTotal - a.rolling7DaysTotal)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.rolling7DaysTotal,
      format: (v: number) => `${v} דק'`,
    },
    {
      key: 'medalScore',
      title: 'ניקוד מדליות',
      icon: <Trophy className="h-4 w-4" />,
      color: 'from-purple-500/20 to-violet-500/20',
      borderColor: 'border-purple-500/40',
      textColor: 'text-purple-400',
      entries: [...leaderboard]
        .filter(e => e.currentMedalScore > 0)
        .sort((a, b) => b.currentMedalScore - a.currentMedalScore)
        .slice(0, 3),
      getValue: (e: YearlyLeaderboardEntry) => e.currentMedalScore,
      format: (v: number) => formatPriceCompact(v),
    },
  ];

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-yellow-500/50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.15),transparent_50%)]" />
      
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="text-center text-xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          לוח המצטיינות
          <Trophy className="h-5 w-5 text-yellow-400" />
        </CardTitle>
      </CardHeader>

      <CardContent className="relative z-10 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map(cat => (
            <div 
              key={cat.key}
              className={`p-3 rounded-lg bg-gradient-to-br ${cat.color} border ${cat.borderColor}`}
            >
              <div className={`flex items-center gap-1.5 mb-2 ${cat.textColor}`}>
                {cat.icon}
                <span className="text-xs font-semibold">{cat.title}</span>
              </div>
              
              <div className="space-y-1.5">
                {cat.entries.length > 0 ? (
                  cat.entries.map((entry, idx) => (
                    <div
                      key={`${entry.studentId}-${cat.key}`}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-lg flex-shrink-0">{getMedalEmoji(idx)}</span>
                        <span className="text-yellow-100/90 truncate">{entry.studentName}</span>
                      </div>
                      <Badge className="bg-black/40 text-yellow-200 text-[10px] px-1.5 py-0.5 flex-shrink-0">
                        {cat.format(cat.getValue(entry))}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-yellow-200/50 text-center py-2">
                    אין נתונים
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-3 text-center">
          <span className="text-[10px] text-yellow-300/60">
            💪 המשיכי להתאמן כדי לעלות בדירוג! 🎵
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompactLeaderboard;

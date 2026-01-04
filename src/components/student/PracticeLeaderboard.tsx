import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Clock, Target, Calendar, TrendingUp, Award } from 'lucide-react';
import { getYearlyLeaderboard } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { YearlyLeaderboardEntry } from '@/lib/types';
import { formatPriceCompact } from '@/lib/storeCurrency';

const PracticeLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<YearlyLeaderboardEntry[]>([]);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000); // Refresh every 30 seconds
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

  // Category 1: Max daily total - yearly
  const topMaxDailyYearly = [...leaderboard]
    .filter(e => e.maxDailyMinutesYearly > 0)
    .sort((a, b) => b.maxDailyMinutesYearly - a.maxDailyMinutesYearly)
    .slice(0, 3);

  // Category 2: Longest streak - yearly
  const topStreakYearly = [...leaderboard]
    .filter(e => e.maxStreakYearly > 0)
    .sort((a, b) => b.maxStreakYearly - a.maxStreakYearly)
    .slice(0, 3);

  // Category 3: Highest weekly average between lessons - yearly
  const topAvgBetweenLessons = [...leaderboard]
    .filter(e => e.maxAvgBetweenLessons > 0)
    .sort((a, b) => b.maxAvgBetweenLessons - a.maxAvgBetweenLessons)
    .slice(0, 3);

  // Category 4: Max daily total - current calendar week
  const topMaxDailyWeekly = [...leaderboard]
    .filter(e => e.maxDailyMinutesWeekly > 0)
    .sort((a, b) => b.maxDailyMinutesWeekly - a.maxDailyMinutesWeekly)
    .slice(0, 3);

  // Category 5: Rolling 7 days total
  const topRolling7Days = [...leaderboard]
    .filter(e => e.rolling7DaysTotal > 0)
    .sort((a, b) => b.rolling7DaysTotal - a.rolling7DaysTotal)
    .slice(0, 3);

  // KPI: Medal score - get top student for display
  const topMedalScore = [...leaderboard]
    .filter(e => e.currentMedalScore > 0)
    .sort((a, b) => b.currentMedalScore - a.currentMedalScore)
    .slice(0, 1)[0];

  const renderLeaderboardSection = (
    title: string,
    icon: React.ReactNode,
    entries: YearlyLeaderboardEntry[],
    getValue: (e: YearlyLeaderboardEntry) => number,
    formatValue: (v: number) => string,
    gradientFrom: string,
    gradientTo: string,
    borderColor: string,
    badgeColor: string
  ) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-lg text-yellow-300">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2">
        {entries.length > 0 ? (
          entries.map((entry, idx) => (
            <div
              key={`${entry.studentId}-${title}`}
              className={`flex items-center justify-between p-3 rounded-lg bg-gradient-to-r ${gradientFrom} ${gradientTo} border ${borderColor} hover:border-opacity-100 transition-all hover:shadow-lg`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalEmoji(idx)}</span>
                <div>
                  <div className="font-medium text-yellow-100">{entry.studentName}</div>
                  <div className="text-xs text-yellow-300/60">מקום {idx + 1}</div>
                </div>
              </div>
              <Badge className={`${badgeColor} text-base px-3 py-1`}>
                {formatValue(getValue(entry))}
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-yellow-200/60 text-center py-4">
            עדיין אין נתונים
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black border-2 border-yellow-400">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.1),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,rgba(255,215,0,0.3)_49%,rgba(255,215,0,0.3)_51%,transparent_52%)] bg-[length:20px_20px] opacity-20" />
        
        <CardHeader className="relative z-10">
          <CardTitle className="text-center text-3xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent animate-pulse">
            🏆 לוח המצטיינות השנתי 🏆
          </CardTitle>
          <p className="text-center text-sm text-yellow-200/80">
            הישגי השנה הנוכחית (ספטמבר עד אוגוסט)
          </p>
          
          {/* KPI: Medal Score */}
          {topMedalScore && (
            <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-lg border border-purple-500/50 text-center">
              <div className="flex items-center justify-center gap-2 text-purple-300">
                <Award className="h-5 w-5" />
                <span className="font-semibold">מובילת ניקוד המדליות</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="text-2xl">🏅</span>
                <span className="text-yellow-100 font-medium">{topMedalScore.studentName}</span>
                <Badge className="bg-purple-600 text-purple-50 px-3 py-1">
                  {formatPriceCompact(topMedalScore.currentMedalScore)}
                </Badge>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6 relative z-10">
          {/* Category 1: Max Daily Total - Yearly */}
          {renderLeaderboardSection(
            'שיא סך יומי - שנתי',
            <Clock className="h-5 w-5 text-green-400" />,
            topMaxDailyYearly,
            e => e.maxDailyMinutesYearly,
            v => `${v} דקות ביום`,
            'from-green-900/30',
            'to-teal-900/30',
            'border-green-600/50',
            'bg-green-600 text-green-50 border-green-400'
          )}

          {/* Category 2: Longest Streak - Yearly */}
          {renderLeaderboardSection(
            'רצף ימי אימון הארוך ביותר - שנתי',
            <Flame className="h-5 w-5 text-orange-400" />,
            topStreakYearly,
            e => e.maxStreakYearly,
            v => `${v} ימים רצופים`,
            'from-orange-900/30',
            'to-red-900/30',
            'border-orange-600/50',
            'bg-orange-600 text-orange-50 border-orange-400'
          )}

          {/* Category 3: Highest Weekly Average Between Lessons */}
          {renderLeaderboardSection(
            'ממוצע אימונים שבועי גבוה ביותר - שנתי',
            <Target className="h-5 w-5 text-blue-400" />,
            topAvgBetweenLessons,
            e => e.maxAvgBetweenLessons,
            v => `${v.toFixed(1)} דק' ממוצע`,
            'from-blue-900/30',
            'to-indigo-900/30',
            'border-blue-600/50',
            'bg-blue-600 text-blue-50 border-blue-400'
          )}

          {/* Category 4: Max Daily Total - Current Week */}
          {renderLeaderboardSection(
            'שיא סך יומי - שבוע נוכחי (שבת-שבת)',
            <Calendar className="h-5 w-5 text-cyan-400" />,
            topMaxDailyWeekly,
            e => e.maxDailyMinutesWeekly,
            v => `${v} דקות ביום`,
            'from-cyan-900/30',
            'to-sky-900/30',
            'border-cyan-600/50',
            'bg-cyan-600 text-cyan-50 border-cyan-400'
          )}

          {/* Category 5: Rolling 7 Days Total */}
          {renderLeaderboardSection(
            'שיא שבועי - 7 ימים מתגלגלים',
            <TrendingUp className="h-5 w-5 text-pink-400" />,
            topRolling7Days,
            e => e.rolling7DaysTotal,
            v => `${v} דקות סה"כ`,
            'from-pink-900/30',
            'to-rose-900/30',
            'border-pink-600/50',
            'bg-pink-600 text-pink-50 border-pink-400'
          )}

          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg border border-yellow-500/40">
            <p className="text-sm text-center text-yellow-100 font-semibold">
              💪 המשיכי להתאמן בקביעות כדי לעלות בדירוג! כל אימון קטן משנה! 🎵
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeLeaderboard;

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Clock, Target, Award, Calendar } from 'lucide-react';
import { getAllLeaderboards, getStudentLeaderboardData, getAcademicYearBounds, StudentLeaderboardData } from '@/lib/leaderboardEngine';
import { getAcademicYearSettings } from '@/lib/storage';
import { useEffect, useState } from 'react';

interface Props {
  currentStudentId?: string;
}

const PracticeLeaderboard = ({ currentStudentId }: Props) => {
  const [leaderboards, setLeaderboards] = useState<ReturnType<typeof getAllLeaderboards> | null>(null);
  const [personalData, setPersonalData] = useState<StudentLeaderboardData | null>(null);

  // Load on mount and when studentId changes - NO polling (updates via data changes only)
  useEffect(() => {
    loadLeaderboards();
  }, [currentStudentId]);

  const loadLeaderboards = () => {
    setLeaderboards(getAllLeaderboards());
    if (currentStudentId) {
      setPersonalData(getStudentLeaderboardData(currentStudentId));
    }
  };

  const getMedalEmoji = (position: number) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return '⭐';
  };

  const academicSettings = getAcademicYearSettings();
  const academicYearLabel = academicSettings 
    ? `${academicSettings.startDate.slice(0, 4)}-${academicSettings.endDate.slice(0, 4)}`
    : 'שנה נוכחית';

  if (!leaderboards) {
    return <div className="text-center py-8 text-muted-foreground">טוען...</div>;
  }

  const categories = [
    {
      key: 'bestLessonAverage',
      title: 'ממוצע אימונים שבועי – שנתי',
      icon: <Target className="h-5 w-5 text-blue-400" />,
      gradient: 'from-blue-900/30 to-cyan-900/30',
      border: 'border-blue-600/50 hover:border-blue-400',
      badge: 'bg-blue-600 text-blue-50 border-blue-400',
      entries: leaderboards.bestLessonAverage.entries,
      personalValue: personalData?.bestLessonAverage 
        ? `${personalData.bestLessonAverage.average.toFixed(1)} דק' ליום`
        : null,
      personalDetail: personalData?.bestLessonAverage
        ? `${personalData.bestLessonAverage.startDate} - ${personalData.bestLessonAverage.endDate}`
        : null,
    },
    {
      key: 'longestStreak',
      title: 'רצף אימונים שנתי',
      icon: <Flame className="h-5 w-5 text-orange-400" />,
      gradient: 'from-orange-900/30 to-red-900/30',
      border: 'border-orange-600/50 hover:border-orange-400',
      badge: 'bg-orange-600 text-orange-50 border-orange-400',
      entries: leaderboards.longestStreak.entries,
      personalValue: personalData?.longestStreak 
        ? `${personalData.longestStreak.days} ימים`
        : null,
      personalDetail: personalData?.longestStreak
        ? `${personalData.longestStreak.startDate} - ${personalData.longestStreak.endDate}`
        : null,
    },
    {
      key: 'medalScore',
      title: 'ניקוד מדליות שנתי',
      icon: <Award className="h-5 w-5 text-purple-400" />,
      gradient: 'from-purple-900/30 to-pink-900/30',
      border: 'border-purple-600/50 hover:border-purple-400',
      badge: 'bg-purple-600 text-purple-50 border-purple-400',
      entries: leaderboards.medalScore.entries,
      personalValue: personalData?.medalScore 
        ? `${personalData.medalScore} נקודות`
        : null,
    },
    {
      key: 'weeklyRecord',
      title: 'דקות אימון שבועי – שיא',
      icon: <Calendar className="h-5 w-5 text-green-400" />,
      gradient: 'from-green-900/30 to-teal-900/30',
      border: 'border-green-600/50 hover:border-green-400',
      badge: 'bg-green-600 text-green-50 border-green-400',
      entries: leaderboards.weeklyRecord.entries,
      personalValue: personalData?.weeklyRecord 
        ? `${personalData.weeklyRecord.minutes} דקות`
        : null,
      personalDetail: personalData?.weeklyRecord
        ? `שבוע ${personalData.weeklyRecord.weekStart}`
        : null,
    },
    {
      key: 'dailyRecord',
      title: 'דקות אימון יומי – שיא (168 שעות אחרונות)',
      icon: <Clock className="h-5 w-5 text-yellow-400" />,
      gradient: 'from-yellow-900/30 to-amber-900/30',
      border: 'border-yellow-600/50 hover:border-yellow-400',
      badge: 'bg-yellow-600 text-yellow-50 border-yellow-400',
      entries: leaderboards.dailyRecord.entries,
      personalValue: personalData?.dailyRecord 
        ? `${personalData.dailyRecord.minutes} דקות`
        : null,
      personalDetail: personalData?.dailyRecord
        ? personalData.dailyRecord.date
        : null,
    },
  ];

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
            שנת לימודים {academicYearLabel} | 3 המצטיינות הגבוהות בכל קטגוריה
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6 relative z-10">
          {categories.map((category) => (
            <div key={category.key} className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-lg text-yellow-300">
                {category.icon}
                <span>{category.title}</span>
              </div>
              <div className="space-y-2">
                {category.entries.length > 0 ? (
                  category.entries.map((entry, idx) => (
                    <div
                      key={entry.studentId}
                      className={`flex items-center justify-between p-3 rounded-lg bg-gradient-to-r ${category.gradient} border ${category.border} transition-all hover:shadow-lg`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalEmoji(idx)}</span>
                        <div>
                          <div className="font-medium text-yellow-100">{entry.studentName}</div>
                          <div className="text-xs text-yellow-300/60">מקום {idx + 1}</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge className={`${category.badge} text-base px-3 py-1`}>
                          {entry.displayValue}
                        </Badge>
                        {entry.detail && (
                          <div className="text-xs text-yellow-300/50 mt-1">{entry.detail}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-yellow-200/60 text-center py-4">
                    עדיין אין נתונים
                  </p>
                )}
              </div>
              
              {/* Personal achievement (if not in top 3) */}
              {currentStudentId && personalData && category.personalValue && 
               !category.entries.some(e => e.studentId === currentStudentId) && (
                <div className="mt-2 p-2 rounded-lg bg-gray-800/50 border border-gray-600/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">ההישג שלך:</span>
                    <div className="text-left">
                      <span className="text-yellow-200">{category.personalValue}</span>
                      {category.personalDetail && (
                        <span className="text-gray-500 text-xs mr-2">({category.personalDetail})</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

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
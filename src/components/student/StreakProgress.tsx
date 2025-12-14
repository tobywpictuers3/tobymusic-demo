import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCurrentStreak, getNextStreakMedalInfo, getStreakMedalLevel, getStreakMedalInfo } from '@/lib/medalEngine';

interface StreakProgressProps {
  studentId: string;
}

const StreakProgress = ({ studentId }: StreakProgressProps) => {
  const [currentStreakDays, setCurrentStreakDays] = useState(0);
  const [daysToNextMedal, setDaysToNextMedal] = useState<{ days: number; medal: string } | null>(null);
  const [currentMedalInfo, setCurrentMedalInfo] = useState<{ icon: string; name: string } | null>(null);

  useEffect(() => {
    // Derive streak from practice history (calendar-based)
    const streak = getCurrentStreak(studentId);
    setCurrentStreakDays(streak);

    // Get current medal info
    const level = getStreakMedalLevel(streak);
    if (level) {
      setCurrentMedalInfo(getStreakMedalInfo(level));
    } else {
      setCurrentMedalInfo(null);
    }

    // Calculate days to next medal using new thresholds (4/7/13/21)
    const nextInfo = getNextStreakMedalInfo(streak);
    if (nextInfo) {
      setDaysToNextMedal({
        days: nextInfo.remaining,
        medal: nextInfo.nextMedal,
      });
    } else {
      setDaysToNextMedal(null);
    }
  }, [studentId]);

  if (currentStreakDays === 0 && !daysToNextMedal) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          התקדמות רצף אימונים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
            <div className="text-sm text-muted-foreground mb-2">הרצף הנוכחי שלך</div>
            <div className="text-4xl font-bold text-orange-600 flex items-center justify-center gap-2">
              <Flame className="h-8 w-8" />
              {currentStreakDays} ימים
            </div>
            {currentMedalInfo && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-sm">
                  {currentMedalInfo.icon} {currentMedalInfo.name}
                </Badge>
              </div>
            )}
          </div>

          {daysToNextMedal && (
            <div className="text-center p-4 bg-background/50 rounded-lg border border-border">
              <div className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                עד למדליה הבאה
              </div>
              <div className="text-2xl font-bold text-primary mb-2">
                {daysToNextMedal.days} {daysToNextMedal.days === 1 ? 'יום' : 'ימים'}
              </div>
              <Badge variant="secondary" className="text-sm">
                {daysToNextMedal.medal}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StreakProgress;

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Calendar } from 'lucide-react';
import { getStudentPracticeSessions } from '@/lib/storage';
import { useEffect, useState } from 'react';

interface StreakProgressProps {
  studentId: string;
}

const StreakProgress = ({ studentId }: StreakProgressProps) => {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [daysToNextMedal, setDaysToNextMedal] = useState<{ days: number; medal: string } | null>(null);

  useEffect(() => {
    calculateStreak();
  }, [studentId]);

  const calculateStreak = () => {
    const sessions = getStudentPracticeSessions(studentId);
    if (sessions.length === 0) {
      setCurrentStreak(0);
      setDaysToNextMedal({ days: 3, medal: '🥉 רצף 3 ימים' });
      return;
    }

    // Group by date
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, typeof sessions>);

    const dates = Object.keys(grouped).sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    
    let streak = 0;
    let checkDate = new Date(today);

    // Check backwards from today
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (grouped[dateStr]) {
        streak++;
      } else if (dateStr < today) {
        // If we find a gap in the past, streak is broken
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    setCurrentStreak(streak);

    // Calculate days to next medal
    const nextMilestones = [
      { days: 3, medal: '🥉 רצף 3 ימים' },
      { days: 5, medal: '🥈 רצף 5 ימים' },
      { days: 7, medal: '🥇 רצף 7 ימים' },
    ];

    const nextMilestone = nextMilestones.find(m => m.days > streak);
    if (nextMilestone) {
      setDaysToNextMedal({
        days: nextMilestone.days - streak,
        medal: nextMilestone.medal,
      });
    } else {
      setDaysToNextMedal(null);
    }
  };

  if (currentStreak === 0 && !daysToNextMedal) {
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
              {currentStreak} ימים
            </div>
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

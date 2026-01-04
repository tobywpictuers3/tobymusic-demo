import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { History, Trash2 } from 'lucide-react';
import { getStudentPracticeSessions, deletePracticeSession } from '@/lib/storage';
import { PracticeSession } from '@/lib/types';
import { getDailyMedalLevel, getDailyMedalInfo } from '@/lib/medalEngine';
import { toast } from '@/hooks/use-toast';

interface PracticeHistoryProps {
  studentId: string;
  refreshKey?: number;
  onRefresh?: () => void;
}

interface DailyStats {
  date: string;
  sessions: PracticeSession[];
  totalMinutes: number;
  medalIcon: string;
  medalName: string;
}

const PracticeHistory = ({ studentId, refreshKey = 0, onRefresh }: PracticeHistoryProps) => {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const sessions = getStudentPracticeSessions(studentId);
    
    // Group sessions by date
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, PracticeSession[]>);

    // Calculate stats with derived medals
    const stats: DailyStats[] = Object.entries(grouped)
      .map(([date, daySessions]) => {
        const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const level = getDailyMedalLevel(totalMinutes);
        const medalInfo = getDailyMedalInfo(level);

        return { 
          date, 
          sessions: daySessions, 
          totalMinutes,
          medalIcon: medalInfo.icon,
          medalName: medalInfo.name,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyStats(stats);
  }, [studentId, refreshKey]);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const deleted = await deletePracticeSession(sessionId);
      
      if (deleted) {
        toast({
          title: '✅ נמחק בהצלחה',
          description: 'האימון נמחק',
          duration: 3000,
        });
        onRefresh?.();
      }
      
      setSessionToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: '❌ שגיאה במחיקה',
        description: 'אנא נסי שוב',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            היסטוריית אימונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>אימונים</TableHead>
                <TableHead>סה"כ</TableHead>
                <TableHead>מדליה</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyStats.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium text-sm">
                    {new Date(day.date).toLocaleDateString('he-IL', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {day.sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                          <div>
                            {session.startTime && session.endTime && (
                              <span>{session.startTime}-{session.endTime}</span>
                            )}
                            <span className="mr-1">({session.durationMinutes}ד')</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0"
                            onClick={() => setSessionToDelete(session.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{day.totalMinutes}ד'</Badge>
                  </TableCell>
                  <TableCell>
                    {day.medalIcon && (
                      <span className="text-sm" title={day.medalName}>{day.medalIcon}</span>
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת אימון</AlertDialogTitle>
            <AlertDialogDescription>
              האם את בטוחה שברצונך למחוק את האימון?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PracticeHistory;

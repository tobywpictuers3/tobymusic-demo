import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { workerApi } from '@/lib/workerApi';
import { logger } from '@/lib/logger';
import { isDevMode } from '@/lib/storage';
import { restorePracticeSessionsFromVersion } from '@/lib/practiceRestore';
import { 
  History, 
  Download, 
  RefreshCw, 
  RotateCcw,
  Calendar,
  HardDrive,
  Loader2,
  Dumbbell
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VersionInfo {
  path: string;
  server_modified: string;
  size: number;
  content_hash?: string;
}

const BackupHistory = () => {
  // 🔒 CRITICAL: Block entire component in dev mode
  if (isDevMode()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            היסטוריית גיבויים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-4">🔧</div>
            <p className="text-lg font-medium mb-2">לא זמין במצב מפתחים</p>
            <p className="text-sm">היסטוריית גיבויים זמינה רק במצב ניהול רגיל</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPracticeRestoreDialogOpen, setIsPracticeRestoreDialogOpen] = useState(false);
  const [isRestoringPractice, setIsRestoringPractice] = useState(false);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const result = await workerApi.listVersions();
      
      if (result.success && result.data) {
        // Sort by date: newest first
        const sorted = result.data.sort((a: VersionInfo, b: VersionInfo) => 
          new Date(b.server_modified).getTime() - new Date(a.server_modified).getTime()
        );
        setVersions(sorted);
        logger.info(`Loaded ${sorted.length} versions`);
      } else {
        logger.error('Failed to load versions:', result.error);
        toast({
          title: '❌ שגיאה בטעינת היסטוריה',
          description: `שגיאה: ${result.error || 'לא ניתן לטעון את רשימת הגרסאות'}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error loading versions:', error);
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה';
      toast({
        title: '❌ שגיאה',
        description: `אירעה תקלה: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionClick = (version: VersionInfo) => {
    setSelectedVersion(version);
    setIsRestoreDialogOpen(true);
  };

  const handlePracticeRestoreClick = (version: VersionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedVersion(version);
    setIsPracticeRestoreDialogOpen(true);
  };

  const handlePracticeRestore = async () => {
    if (!selectedVersion) return;

    setIsRestoringPractice(true);
    try {
      const result = await restorePracticeSessionsFromVersion(selectedVersion.path);
      
      if (result.success) {
        toast({
          title: '✅ שחזור אימונים הושלם',
          description: `${result.restored} אימונים שוחזרו בהצלחה. הדף יתרענן...`,
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({
          title: '❌ שגיאה בשחזור אימונים',
          description: result.error || 'לא ניתן לשחזר את האימונים',
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error restoring practice sessions:', error);
      toast({
        title: '❌ שגיאה',
        description: 'אירעה תקלה. נסי שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoringPractice(false);
      setIsPracticeRestoreDialogOpen(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;

    setIsRestoring(true);
    try {
      const result = await workerApi.downloadByPath(selectedVersion.path);
      
      if (result.success && result.data) {
        // Update localStorage with restored data
        Object.keys(result.data).forEach(key => {
          const value = result.data[key];
          localStorage.setItem(
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          );
        });

        toast({
          title: '✅ השחזור הושלם',
          description: 'הנתונים שוחזרו בהצלחה. הדף יתרענן...',
        });

        // Reload the page to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({
          title: '❌ שגיאה בשחזור',
          description: result.error || 'לא ניתן לשחזר את הגרסה',
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error restoring version:', error);
      toast({
        title: '❌ שגיאה',
        description: 'אירעה תקלה. נסי שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
      setIsRestoreDialogOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              היסטוריית גיבויים
              {versions.length > 0 && (
                <Badge variant="secondary">{versions.length} גרסאות</Badge>
              )}
            </CardTitle>
            <Button 
              onClick={loadVersions} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              רענן
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>🔒 מקור האמת:</strong> כל הגרסאות נשמרות ב-Worker החיצוני שלך בלבד.
                <br />
                לחצי על גרסה כדי לשחזר אותה.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-3 text-muted-foreground">טוען גרסאות...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">אין גרסאות שמורות</p>
                <p className="text-sm text-muted-foreground mt-2">
                  הגרסה הראשונה תישמר אוטומטית עם השינוי הבא
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך ושעה</TableHead>
                      <TableHead className="text-right">גודל</TableHead>
                      <TableHead className="text-right">נתיב</TableHead>
                      <TableHead className="text-right" colSpan={2}>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((version, index) => (
                      <TableRow 
                        key={version.path}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleVersionClick(version)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(version.server_modified)}
                            {index === 0 && (
                              <Badge variant="default" className="mr-2">
                                אחרון
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatSize(version.size)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {version.path.split('/').pop()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVersionClick(version);
                            }}
                          >
                            <RotateCcw className="h-4 w-4 ml-2" />
                            שחזר הכל
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handlePracticeRestoreClick(version, e)}
                          >
                            <Dumbbell className="h-4 w-4 ml-2" />
                            שחזר רק אימונים
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full Restore Dialog */}
      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>שחזור גרסה</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  האם את בטוחה שברצונך לשחזר את הגרסה הזו?
                </p>
                {selectedVersion && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">תאריך:</span>
                      <span>{formatDate(selectedVersion.server_modified)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">גודל:</span>
                      <span>{formatSize(selectedVersion.size)}</span>
                    </div>
                  </div>
                )}
                <p className="text-destructive font-medium">
                  ⚠️ פעולה זו תחליף את כל הנתונים הנוכחיים!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestore}
              disabled={isRestoring}
              className="bg-primary"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  משחזר...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 ml-2" />
                  שחזר גרסה
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Practice Sessions Only Restore Dialog */}
      <AlertDialog open={isPracticeRestoreDialogOpen} onOpenChange={setIsPracticeRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>שחזור אימונים בלבד</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  פעולה זו תשחזר רק את נתוני האימונים מהגרסה הזו.
                </p>
                {selectedVersion && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">תאריך:</span>
                      <span>{formatDate(selectedVersion.server_modified)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">גודל:</span>
                      <span>{formatSize(selectedVersion.size)}</span>
                    </div>
                  </div>
                )}
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium">
                    ✅ בטוח: כל שאר הנתונים (תלמידות, שיעורים, תשלומים) יישארו ללא שינוי
                  </p>
                </div>
                <p className="text-destructive font-medium text-sm">
                  ⚠️ נתוני האימונים הנוכחיים יוחלפו באימונים מהגרסה הזו
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoringPractice}>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePracticeRestore}
              disabled={isRestoringPractice}
              className="bg-primary"
            >
              {isRestoringPractice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  משחזר אימונים...
                </>
              ) : (
                <>
                  <Dumbbell className="h-4 w-4 ml-2" />
                  שחזר אימונים
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BackupHistory;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { workerApi } from '@/lib/workerApi';
import { logger } from '@/lib/logger';
import { 
  History, 
  Download, 
  RefreshCw, 
  RotateCcw,
  Calendar,
  HardDrive,
  Loader2
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
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
        toast({
          title: '❌ שגיאה בטעינת היסטוריה',
          description: result.error || 'לא ניתן לטעון את רשימת הגרסאות',
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Error loading versions:', error);
      toast({
        title: '❌ שגיאה',
        description: 'אירעה תקלה. נסי שוב.',
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
                      <TableHead className="text-right">פעולות</TableHead>
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
                            שחזר
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
    </div>
  );
};

export default BackupHistory;

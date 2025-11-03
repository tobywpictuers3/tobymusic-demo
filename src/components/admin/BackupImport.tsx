import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Cloud, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { hybridSync } from '@/lib/hybridSync';
import { logger } from '@/lib/logger';

const BackupImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      const success = await hybridSync.manualSync();
      
      if (success) {
        toast({
          title: '✅ סנכרון הושלם',
          description: 'הנתונים סונכרנו ל-Worker בהצלחה',
        });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      logger.error('Manual sync error:', error);
      toast({
        title: '❌ שגיאה בסנכרון',
        description: 'אירעה תקלה. נסי שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    try {
      hybridSync.downloadBackup();
      toast({
        title: '✅ הגיבוי הורד',
        description: 'קובץ הגיבוי נשמר במחשב',
      });
    } catch (error) {
      logger.error('Download backup error:', error);
      toast({
        title: '❌ שגיאה בהורדה',
        description: 'אירעה תקלה. נסי שוב.',
        variant: 'destructive',
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: 'שגיאה',
        description: 'ניתן לטעון רק קבצי JSON',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await hybridSync.importBackup(file);
      
      if (success) {
        toast({
          title: '✅ הגיבוי יובא',
          description: 'הנתונים טעונו וסונכרנו. הדף יתרענן...',
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error('Import failed');
      }
    } catch (error) {
      logger.error('Import error:', error);
      toast({
        title: '❌ שגיאה ביבוא',
        description: 'אירעה תקלה. נסי שוב.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const syncState = hybridSync.getSyncState();

  return (
    <div className="space-y-6">
      {/* Worker Sync Card */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            סנכרון Worker - מקור האמת
            {syncState.isOnline ? (
              <Badge variant="default">🟢 מקוון</Badge>
            ) : (
              <Badge variant="destructive">🔴 לא מקוון</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>🔒 מקור האמת:</strong> כל הנתונים נשמרים ב-Worker החיצוני שלך בלבד
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>📱 localStorage:</strong> משמש רק כמטמון זמני לעבודה מהירה
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>🔄 סנכרון אוטומטי:</strong> כל 30 דקות + אחרי כל שינוי
            </p>
            {syncState.lastSyncTime && (
              <p className="text-sm text-muted-foreground">
                <strong>⏰ סנכרון אחרון:</strong>{' '}
                {new Date(syncState.lastSyncTime).toLocaleString('he-IL')}
              </p>
            )}
            {syncState.pendingChanges > 0 && (
              <p className="text-sm text-yellow-600">
                <strong>⚠️ שינויים ממתינים:</strong> {syncState.pendingChanges}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleManualSync} 
              disabled={isLoading || !syncState.isOnline}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Cloud className="h-4 w-4 ml-2" />
              )}
              סנכרון ידני
            </Button>
          </div>

          {!syncState.isOnline && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>📡 אין חיבור לאינטרנט</strong>
                <br />
                המערכת עובדת במצב אופליין. הנתונים יסתנכרנו אוטומטית כשהחיבור יחזור.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Local Backup Card */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            גיבוי מקומי
            <Badge variant="secondary">ידני בלבד</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                ייצוא ויבוא של קובצי גיבוי JSON
              </p>
              
              <div className="flex gap-2 mb-4">
                <Button onClick={handleDownloadBackup} disabled={isLoading}>
                  <Download className="h-4 w-4 ml-2" />
                  הורד גיבוי מקומי
                </Button>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                  id="file-upload"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  טען גיבוי מקובץ
                </Button>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">
                ℹ️ הערה חשובה
              </p>
              <p className="text-sm text-muted-foreground">
                יבוא קובץ גיבוי יחליף את כל הנתונים הנוכחיים ויסנכרן אוטומטית ל-Worker.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupImport;

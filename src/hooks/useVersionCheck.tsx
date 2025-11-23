import { useEffect, useState } from 'react';
import { workerApi } from '@/lib/workerApi';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export const useVersionCheck = () => {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Get initial version on mount
    const initVersion = async () => {
      try {
        const response = await workerApi.downloadLatest();
        if (response.success && response.data?.metadata?.lastModified) {
          setCurrentVersion(response.data.metadata.lastModified);
          console.log('📍 גרסה נוכחית:', response.data.metadata.lastModified);
        }
      } catch (error) {
        console.error('שגיאה בטעינת גרסה נוכחית:', error);
      }
    };

    initVersion();
  }, []);

  useEffect(() => {
    if (!currentVersion) return;

    const checkForUpdates = async () => {
      if (isChecking) return;
      
      setIsChecking(true);
      try {
        const response = await workerApi.downloadLatest();
        
        if (response.success && response.data?.metadata?.lastModified) {
          const latestVersion = response.data.metadata.lastModified;
          
          // Check if there's a newer version
          if (latestVersion !== currentVersion) {
            const latestTime = new Date(latestVersion).getTime();
            const currentTime = new Date(currentVersion).getTime();
            
            if (latestTime > currentTime) {
              console.log('🔄 גרסה חדשה זמינה:', latestVersion);
              
              // Show toast with refresh option
              toast({
                title: "🔄 גרסה חדשה זמינה",
                description: "יש עדכון חדש. רענן את הדף כדי לראות את השינויים האחרונים.",
                action: (
                  <Button
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="ml-2"
                  >
                    רענן עכשיו
                  </Button>
                ),
                duration: 60000, // Show for 1 minute
              });
              
              // Update current version to avoid showing multiple toasts
              setCurrentVersion(latestVersion);
            }
          }
        }
      } catch (error) {
        console.error('שגיאה בבדיקת גרסה:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkForUpdates, 30000);

    return () => clearInterval(interval);
  }, [currentVersion, isChecking]);

  return { currentVersion };
};

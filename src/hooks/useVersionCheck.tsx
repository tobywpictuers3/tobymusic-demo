import { useEffect } from 'react';
import { checkVersionAndClearCache } from '@/lib/cacheManager';
import { logger } from '@/lib/logger';

/**
 * Hook that checks app version on mount and clears cache if version changed
 * Should be called once in App.tsx
 */
export const useVersionCheck = () => {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info('🚀 Initializing app...');
        await checkVersionAndClearCache();
        logger.info('✅ App initialized successfully');
      } catch (error) {
        logger.error('❌ Error initializing app:', error);
      }
    };

    initializeApp();
  }, []);
};

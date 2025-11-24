import { logger } from './logger';

// Version number - increment this to force cache clear on all clients
const APP_VERSION = '1.0.1';

/**
 * Clears all client-side caches, service workers, localStorage, and IndexedDB
 * Does NOT reload the page - caller is responsible for navigation/reload
 */
export const clearClientCaches = async (): Promise<void> => {
  try {
    logger.info('🧹 Starting cache cleanup...');

    // ⚠️ DON'T unregister Service Workers here - main.tsx handles it
    // This prevents conflicts and allows PWA to work properly

    // 1. Delete all browser caches (SW will recreate minimal cache if needed)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          logger.info(`🗑️ Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
      logger.info('✅ All caches deleted');
    }

    // 2. Clear localStorage EXCEPT session data
    try {
      // 🔒 CRITICAL: Preserve hybridSync session
      const sessionData = localStorage.getItem('hybridSync_session');
      const appVersion = localStorage.getItem('app_version');
      
      localStorage.clear();
      
      // Restore critical data
      if (sessionData) {
        localStorage.setItem('hybridSync_session', sessionData);
      }
      if (appVersion) {
        localStorage.setItem('app_version', appVersion);
      }
      
      logger.info('✅ localStorage cleared (session preserved)');
    } catch (error) {
      logger.warn('⚠️ Could not clear localStorage:', error);
    }

    // 3. Clear sessionStorage (except dev mode flag)
    try {
      const devMode = sessionStorage.getItem('musicSystem_devMode');
      sessionStorage.clear();
      if (devMode) {
        sessionStorage.setItem('musicSystem_devMode', devMode);
      }
      logger.info('✅ sessionStorage cleared (devMode preserved)');
    } catch (error) {
      logger.warn('⚠️ Could not clear sessionStorage:', error);
    }

    // 4. Delete IndexedDB databases (EXCEPT hybridSync ones)
    if ('indexedDB' in window) {
      const dbNames = [
        'firebase-heartbeat',
        'LocalForage',
        'firebaseLocalStorageDb'
      ];

      for (const dbName of dbNames) {
        try {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = resolve;
            deleteRequest.onerror = reject;
            deleteRequest.onblocked = resolve;
          });
          logger.info(`🗑️ IndexedDB deleted: ${dbName}`);
        } catch (error) {
          logger.warn(`⚠️ Could not delete IndexedDB: ${dbName}`, error);
        }
      }
      
      // ⚠️ DO NOT DELETE 'sonata-music-v3-gmail-style' - it may contain hybridSync data
      logger.info('ℹ️ Skipped sonata-music-v3-gmail-style IndexedDB (may contain sync data)');
    }

    logger.info('✅ Cache cleanup finished');
  } catch (error) {
    logger.error('❌ Error during cache cleanup:', error);
  }
};

/**
 * Clears all caches and performs hard reload
 */
export const clearCachesAndReload = async (): Promise<void> => {
  await clearClientCaches();
  // Force hard reload
  window.location.reload();
};

/**
 * Checks if app version changed and clears cache if needed
 * Call this once on app initialization (in App.tsx)
 */
export const checkVersionAndClearCache = async (): Promise<void> => {
  try {
    const storedVersion = localStorage.getItem('app_version');
    
    if (storedVersion !== APP_VERSION) {
      logger.info(`🔄 App version changed from ${storedVersion || 'unknown'} to ${APP_VERSION}`);
      logger.info('🧹 Clearing all caches due to version change...');
      
      // Clear everything EXCEPT the version flag (we'll set it after)
      await clearClientCaches();
      
      // Set new version
      localStorage.setItem('app_version', APP_VERSION);
      
      logger.info('✅ Cache cleared successfully for new version');
    } else {
      logger.info(`✓ App version ${APP_VERSION} - cache is up to date`);
    }
  } catch (error) {
    logger.error('❌ Error checking version:', error);
  }
};

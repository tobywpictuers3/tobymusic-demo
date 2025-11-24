import { logger } from './logger';

// Version number - increment this to force cache clear on all clients
const APP_VERSION = '1.0.1';

/**
 * Clears all client-side caches, service workers, localStorage, and IndexedDB
 * Does NOT reload the page - caller is responsible for navigation/reload
 */
export const clearClientCaches = async (): Promise<void> => {
  try {
    logger.info('🧹 Starting complete cache cleanup...');

    // 1. Unregister all Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        logger.info('✅ Service Worker unregistered');
      }
    }

    // 2. Delete all caches
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

    // 3. Clear localStorage
    try {
      localStorage.clear();
      logger.info('✅ localStorage cleared');
    } catch (error) {
      logger.warn('⚠️ Could not clear localStorage:', error);
    }

    // 4. Clear sessionStorage
    try {
      sessionStorage.clear();
      logger.info('✅ sessionStorage cleared');
    } catch (error) {
      logger.warn('⚠️ Could not clear sessionStorage:', error);
    }

    // 5. Delete IndexedDB databases
    if ('indexedDB' in window) {
      const dbNames = [
        'firebase-heartbeat',
        'sonata-music-v3-gmail-style',
        'LocalForage',
        'firebaseLocalStorageDb'
      ];

      for (const dbName of dbNames) {
        try {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = resolve;
            deleteRequest.onerror = reject;
            deleteRequest.onblocked = resolve; // Continue even if blocked
          });
          logger.info(`🗑️ IndexedDB deleted: ${dbName}`);
        } catch (error) {
          logger.warn(`⚠️ Could not delete IndexedDB: ${dbName}`, error);
        }
      }
    }

    logger.info('✅ Complete cache cleanup finished');
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

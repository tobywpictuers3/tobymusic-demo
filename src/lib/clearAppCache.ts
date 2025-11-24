import { logger } from './logger';

/**
 * Clears all app caches, service workers, and IndexedDB databases
 * Forces a complete reload after cleanup
 */
export const clearAppCache = async (): Promise<void> => {
  try {
    logger.info('🧹 Starting cache cleanup...');

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

    // 3. Delete IndexedDB databases
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

    logger.info('✅ Cache cleanup completed');
  } catch (error) {
    logger.error('❌ Error during cache cleanup:', error);
  }
};

/**
 * Clears cache and performs hard reload
 */
export const clearCacheAndReload = async (): Promise<void> => {
  await clearAppCache();
  // Force hard reload
  window.location.reload();
};

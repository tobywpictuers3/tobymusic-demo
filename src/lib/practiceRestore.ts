import { workerApi } from './workerApi';
import { exportAllData, initializeStorage } from './storage';
import { hybridSync } from './hybridSync';
import { logger } from './logger';

/**
 * Smart restore of practice sessions only from a specific version
 * This function:
 * 1. Backs up current data
 * 2. Downloads the old version
 * 3. Extracts only practice sessions
 * 4. Merges with current non-practice data
 * 5. Saves and syncs
 */
export async function restorePracticeSessionsFromVersion(
  versionPath: string
): Promise<{ success: boolean; restored: number; error?: string }> {
  try {
    logger.info('🔄 Starting practice sessions restore from:', versionPath);
    
    // 1. Backup current data
    const currentData = exportAllData(true);
    logger.info('✅ Current data backed up');
    
    // 2. Download old version
    const result = await workerApi.downloadByPath(versionPath);
    if (!result.success || !result.data) {
      logger.error('❌ Failed to download version:', result.error);
      return { success: false, restored: 0, error: result.error || 'Failed to download version' };
    }
    
    logger.info('✅ Old version downloaded');
    
    // 3. Extract practice sessions from old version
    const oldSessions = result.data['musicSystem_practiceSessions'];
    if (!oldSessions) {
      logger.warn('⚠️ No practice sessions found in this version');
      return { success: false, restored: 0, error: 'לא נמצאו אימונים בגרסה זו' };
    }
    
    const sessionsArray = typeof oldSessions === 'string' 
      ? JSON.parse(oldSessions) 
      : oldSessions;
    
    logger.info(`📊 Found ${sessionsArray.length} practice sessions in old version`);
    
    // 4. Merge: Keep all current data except practice sessions
    const merged = {
      ...currentData,
      'musicSystem_practiceSessions': oldSessions
    };
    
    logger.info('🔀 Merged old practice sessions with current data');
    
    // 5. Save merged data and sync
    initializeStorage(merged);
    await hybridSync.onDataChange();
    
    logger.info('✅ Practice sessions restored and synced');
    return { 
      success: true, 
      restored: sessionsArray.length 
    };
    
  } catch (error) {
    logger.error('❌ Failed to restore practice sessions:', error);
    return { 
      success: false, 
      restored: 0, 
      error: error instanceof Error ? error.message : 'שגיאה לא ידועה' 
    };
  }
}

/**
 * Get practice sessions count from a version without restoring
 */
export async function getPracticeSessionsCountFromVersion(
  versionPath: string
): Promise<number> {
  try {
    const result = await workerApi.downloadByPath(versionPath);
    if (!result.success || !result.data) {
      return 0;
    }
    
    const sessions = result.data['musicSystem_practiceSessions'];
    if (!sessions) {
      return 0;
    }
    
    const sessionsArray = typeof sessions === 'string' 
      ? JSON.parse(sessions) 
      : sessions;
    
    return sessionsArray.length;
  } catch (error) {
    logger.error('Failed to get practice sessions count:', error);
    return 0;
  }
}

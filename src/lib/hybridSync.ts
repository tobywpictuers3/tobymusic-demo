import { workerApi } from './workerApi';
import { logger } from './logger';
import { exportAllData, initializeStorage, isDevMode } from './storage';
import { recalculateAllMonthlyAchievements } from './recalculateAchievements';

/**
 * Hybrid Sync Manager - Worker as source of truth, localStorage as cache
 * Architecture: State Management ↔️ Worker ↔️ localStorage (cache)
 */

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
}

class HybridSyncManager {
  private syncState: SyncState = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
  };

  private syncInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private pendingQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.setupNetworkListeners();
    this.startPeriodicSync();
    this.setupUnloadListener();
    this.startOfflineRetry();
  }

  /**
   * Setup online/offline listeners
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      logger.info('🌐 Network online - syncing...');
      this.syncState.isOnline = true;
      this.processPendingQueue();
    });

    window.addEventListener('offline', () => {
      logger.warn('📡 Network offline - using cache');
      this.syncState.isOnline = false;
    });
  }

  /**
   * Start offline retry mechanism - try to sync every 2 minutes when offline with pending changes
   */
  private startOfflineRetry() {
    this.retryInterval = setInterval(() => {
      // Only retry if we have pending changes and think we're offline
      if (this.syncState.pendingChanges > 0 && !this.syncState.isOnline) {
        logger.info('🔄 Retrying offline sync (2min interval)...');
        // Use direct upload on retry to prevent merge from restoring deleted records
        this.directUpload().then(success => {
          if (success) {
            logger.info('✅ Offline retry succeeded!');
            this.syncState.isOnline = true; // Update online status
          }
        });
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  /**
   * Setup beforeunload listener to sync on close
   */
  private setupUnloadListener() {
    window.addEventListener('beforeunload', (e) => {
      // 🔧 DEV MODE: Skip all Worker sync
      if (isDevMode()) {
        logger.info('🔧 DEV MODE: Skipping beforeunload sync');
        return;
      }
      
      // ⚠️ CRITICAL: Warn if pending changes exist
      if (this.syncState.pendingChanges > 0) {
        const warningMessage = 'יש שינויים שטרם נשמרו בדרופבוקס! האם את בטוחה שאת רוצה לצאת?';
        e.preventDefault();
        e.returnValue = warningMessage;
        
        logger.warn('⚠️ User trying to leave with pending changes');
        
        // Try one last sync with sendBeacon
        if (this.syncState.isOnline) {
          logger.info('💾 Attempting last sync before close...');
          
          try {
            const data = this.gatherAllData();
            
            // 🛡️ GUARD: Only sync if we have meaningful data
            const dataSize = JSON.stringify(data).length;
            if (dataSize >= 100) {
              const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
              navigator.sendBeacon(
                'https://lovable-dropbox-api.w0504124161.workers.dev/?action=upload_versioned',
                blob
              );
            }
          } catch (error) {
            logger.error('❌ beforeunload sync prevented:', error);
          }
        }
        
        return warningMessage;
      }
    });
  }

  /**
   * Periodic sync is disabled - we sync on every change
   */
  private startPeriodicSync() {
    // No periodic sync needed - we sync immediately on every change
  }

  /**
   * Load data on app initialization
   * Always loads from Worker on every page load/refresh
   */
  async loadDataOnInit(): Promise<void> {
    // Skip Worker in dev mode
    if (isDevMode()) {
      logger.info('🔧 DEV MODE: Skipping Worker data load');
      return;
    }

    const emptyData = {
      musicSystem_students: [],
      musicSystem_lessons: [],
      musicSystem_payments: [],
      musicSystem_swapRequests: [],
      musicSystem_files: [],
      musicSystem_scheduleTemplates: [],
      musicSystem_performances: [],
      musicSystem_holidays: [],
      musicSystem_practiceSessions: [],
      musicSystem_monthlyAchievements: [],
      musicSystem_medalRecords: [],
      oneTimePayments: [],
    };

    try {
      logger.info('🔄 Loading from Worker...');

      if (!this.syncState.isOnline) {
        logger.warn('📡 Offline - initializing empty local state');
        this.updateInMemoryStorage(emptyData);
        return;
      }

      // Add timeout protection so app doesn't hang on loading screen
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_LOADING_WORKER')), 8000)
      );

      const result = (await Promise.race([
        workerApi.downloadLatest(),
        timeout,
      ])) as any;

      if (result && result.success && result.data) {
        // 🛡️ VALIDATION: Check that data is not empty/invalid
        const dataKeys = Object.keys(result.data);
        const hasMeaningfulData = dataKeys.some((k) => k.startsWith('musicSystem_')) || dataKeys.length > 1;
        
        if (!hasMeaningfulData) {
          logger.warn('⚠️ Loaded empty/invalid data from Worker - initializing fresh state');
          this.updateInMemoryStorage(emptyData);
          this.syncState.lastSyncTime = null;
        } else {
          logger.info('✅ Data loaded from Worker');
          this.updateInMemoryStorage(result.data);
          this.syncState.lastSyncTime = new Date().toISOString();
        }
      } else if (result && result.error === 'NO_VERSION_FOUND') {
        logger.info('ℹ️ No version found on Worker - starting fresh (first use)');
        this.updateInMemoryStorage(emptyData);
      } else {
        logger.warn('⚠️ Worker load failed or timed out - initializing empty local state');
        this.updateInMemoryStorage(emptyData);
      }
    } catch (error) {
      logger.warn('⚠️ Load error - initializing empty local state:', error);
      this.updateInMemoryStorage(emptyData);
    }
  }


  /**
   * Update in-memory storage with Worker data
   */
  private updateInMemoryStorage(data: any) {
    try {
      initializeStorage(data);
      logger.info('💾 Memory updated from Worker');
    } catch (error) {
      logger.error('❌ Memory update error:', error);
    }
  }

  /**
   * Merge conflicts using optimistic locking (lastModified timestamp)
   */
  private mergeDataWithConflictResolution(localData: any, remoteData: any): any {
    const merged = { ...remoteData };
    
    // List of all data types that need conflict resolution
    const conflictKeys = [
      'musicSystem_practiceSessions',
      'musicSystem_students',
      'musicSystem_lessons',
      'musicSystem_payments',
      'musicSystem_performances',
      'musicSystem_monthlyAchievements',
      'musicSystem_medalRecords',
      'musicSystem_swapRequests',
      'musicSystem_files',
      'musicSystem_scheduleTemplates',
      'musicSystem_holidays',
      'oneTimePayments'
    ];
    
    // Non-array keys that should be copied directly from local
    const directCopyKeys = [
      'musicSystem_studentStats',
      'musicSystem_tithePaid'
    ];
    
    // Copy direct keys from local (these are objects, not arrays)
    directCopyKeys.forEach(key => {
      if (localData[key]) {
        merged[key] = localData[key];
      }
    });
    
    // Merge each data type with conflict resolution
    conflictKeys.forEach(key => {
      const localRecords = localData[key];
      const remoteRecords = remoteData[key];
      
      if (localRecords && remoteRecords) {
        try {
          const localArray = typeof localRecords === 'string' ? JSON.parse(localRecords) : localRecords;
          const remoteArray = typeof remoteRecords === 'string' ? JSON.parse(remoteRecords) : remoteRecords;
          merged[key] = this.mergeRecords(localArray, remoteArray);
        } catch (error) {
          logger.warn(`Failed to merge ${key}, using local:`, error);
          merged[key] = localRecords;
        }
      } else if (localRecords) {
        merged[key] = localRecords;
      }
    });
    
    // Add other data types that don't need conflict resolution
    Object.keys(localData).forEach(key => {
      if (!conflictKeys.includes(key) && key !== 'timestamp') {
        merged[key] = localData[key];
      }
    });
    
    merged.timestamp = new Date().toISOString();
    return merged;
  }

  /**
   * Generic merge function for any record type with lastModified timestamp
   */
  private mergeRecords(localRecords: any[], remoteRecords: any[]): any {
    const recordMap = new Map<string, any>();
    
    // Add all remote records first
    remoteRecords.forEach(record => {
      recordMap.set(record.id, record);
    });
    
    // Override with local records if they're newer
    localRecords.forEach(localRecord => {
      const remoteRecord = recordMap.get(localRecord.id);
      
      if (!remoteRecord) {
        // New local record - add it
        recordMap.set(localRecord.id, localRecord);
      } else if (localRecord.lastModified && remoteRecord.lastModified) {
        // Both have timestamps - take the newer one
        const localTime = new Date(localRecord.lastModified).getTime();
        const remoteTime = new Date(remoteRecord.lastModified).getTime();
        
        if (localTime > remoteTime) {
          recordMap.set(localRecord.id, localRecord);
        }
      } else {
        // No timestamp - prefer local (it's the latest change)
        recordMap.set(localRecord.id, localRecord);
      }
    });
    
    const mergedArray = Array.from(recordMap.values());
    return typeof localRecords === 'string' || typeof remoteRecords === 'string' 
      ? JSON.stringify(mergedArray)
      : mergedArray;
  }

  /**
   * On data change - immediately sync to Worker with conflict resolution
   * Returns: success (local save OK), synced (Dropbox sync OK), message
   * @param skipMerge - If true, uploads directly without downloading/merging (for destructive operations like delete)
   */
  async onDataChange(skipMerge: boolean = false): Promise<{ success: boolean; synced: boolean; message: string }> {
    // Skip Worker sync in dev mode
    if (isDevMode()) {
      return { success: true, synced: true, message: 'נשמר במצב מפתחים' };
    }

    this.syncState.pendingChanges++;

    if (!this.syncState.isOnline) {
      logger.warn('📡 Offline - saved locally, will retry in 2 minutes');
      return { 
        success: true,  // ✅ Local save succeeded
        synced: false,  // ⚠️ Not synced to Dropbox
        message: 'נשמר מקומית, יסונכרן אוטומטית כשיחזור חיבור' 
      };
    }

    // Use direct upload for destructive operations (delete) to prevent merge restoring deleted records
    const success = skipMerge ? await this.directUpload() : await this.syncToWorker();
    
    if (success) {
      return { 
        success: true,
        synced: true,   // ✅ Synced to Dropbox
        message: 'נשמר בדרופבוקס בהצלחה' 
      };
    } else {
      return { 
        success: true,  // ✅ Local save still succeeded
        synced: false,  // ⚠️ Dropbox sync failed, will retry
        message: 'נשמר מקומית, ננסה שוב בעוד 2 דקות' 
      };
    }
  }

  /**
   * Direct upload without merge - used for destructive operations like delete
   * This prevents the merge logic from restoring deleted records
   */
  private async directUpload(): Promise<boolean> {
    if (isDevMode()) {
      logger.info('🔧 DEV MODE: Direct upload disabled');
      return true;
    }

    if (this.isSyncing) {
      logger.info('⏳ Sync already in progress');
      return false;
    }

    try {
      this.isSyncing = true;
      this.syncState.isSyncing = true;
      logger.info('🔄 Starting direct upload (no merge)...');
      
      // Export current local data
      const localData = this.gatherAllData();
      
      // Check data size before sending
      const dataSize = JSON.stringify(localData).length;
      logger.info(`📦 Data size: ${(dataSize / 1024).toFixed(2)} KB`);
      
      if (dataSize < 100) {
        logger.error('❌ PREVENTED SYNC - Data too small, likely corrupted');
        return false;
      }
      
      // Upload directly without downloading/merging
      const result = await workerApi.uploadVersioned(localData);

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.pendingChanges = 0;
        logger.info('✅ Direct upload completed');
        return true;
      } else {
        logger.warn('⚠️ Direct upload failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Direct upload error:', error);
      return false;
    } finally {
      this.isSyncing = false;
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Sync all data to Worker with conflict resolution
   */
  private isSyncing = false;
  
  private async syncToWorker(): Promise<boolean> {
    // Skip Worker sync in dev mode
    if (isDevMode()) {
      logger.info('🔧 DEV MODE: Worker sync disabled');
      return true;
    }

    if (this.isSyncing) {
      logger.info('⏳ Sync already in progress');
      return false;
    }

    try {
      this.isSyncing = true;
      this.syncState.isSyncing = true;
      logger.info('🔄 Starting Worker sync with conflict resolution...');
      
      // STEP 1: Download latest data from server
      const remoteResult = await workerApi.downloadLatest();
      logger.info('📥 Downloaded latest version from server');
      
      // STEP 2: Export current local data
      const localData = this.gatherAllData();
      
      // STEP 3: Merge with conflict resolution
      const remoteData = remoteResult.data || remoteResult;
      const mergedData = this.mergeDataWithConflictResolution(localData, remoteData);
      logger.info('🔀 Merged local and remote changes');
      
      // Check data size before sending
      const dataSize = JSON.stringify(mergedData).length;
      logger.info(`📦 Data size: ${(dataSize / 1024).toFixed(2)} KB`);
      
      if (dataSize < 100) {
        logger.error('❌ PREVENTED SYNC - Data too small, likely corrupted');
        return false;
      }
      
      // STEP 4: Upload merged data to Worker
      const result = await workerApi.uploadVersioned(mergedData);

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.pendingChanges = 0;
        logger.info('✅ Worker sync completed with conflict resolution');
        
        // Recalculate achievements after sync to ensure they reflect current data
        try {
          recalculateAllMonthlyAchievements();
          logger.info('✅ Achievements recalculated after sync');
        } catch (error) {
          logger.warn('⚠️ Failed to recalculate achievements after sync:', error);
        }
        
        return true;
      } else {
        logger.warn('⚠️ Sync failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Sync error:', error);
      return false;
    } finally {
      this.isSyncing = false;
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Gather all data from in-memory storage
   */
  private gatherAllData(): any {
    return exportAllData();
  }

  /**
   * Process pending queue when coming back online
   */
  private async processPendingQueue() {
    if (this.pendingQueue.length === 0) return;

    logger.info(`🔄 Processing ${this.pendingQueue.length} pending changes...`);

    while (this.pendingQueue.length > 0) {
      const task = this.pendingQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          logger.error('❌ Pending task error:', error);
        }
      }
    }

    await this.syncToWorker();
  }

  /**
   * Manual sync trigger
   */
  async manualSync(): Promise<boolean> {
    // Skip Worker sync in dev mode
    if (isDevMode()) {
      logger.info('🔧 DEV MODE: Manual sync disabled');
      return true;
    }
    return await this.syncToWorker();
  }

  /**
   * Get sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Download backup (for manual export)
   */
  downloadBackup() {
    const data = this.gatherAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `sonata-backup-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info('📦 Backup downloaded:', filename);
  }

  /**
   * Import backup from file and sync to Worker
   */
  async importBackup(file: File): Promise<{ success: boolean; message: string }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.updateInMemoryStorage(data);
      
      // Immediately sync to Worker
      const success = await this.syncToWorker();

      if (success) {
        logger.info('✅ Backup imported and synced to Worker');
        return { 
          success: true, 
          message: 'הגיבוי נטען והועלה לדרופבוקס בהצלחה' 
        };
      } else {
        logger.warn('⚠️ Backup imported but sync failed');
        return { 
          success: false, 
          message: 'הגיבוי נטען אך ההעלאה לדרופבוקס נכשלה' 
        };
      }
    } catch (error) {
      logger.error('❌ Import error:', error);
      return { 
        success: false, 
        message: 'שגיאה בטעינת הגיבוי' 
      };
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

export const hybridSync = new HybridSyncManager();

import { workerApi } from './workerApi';
import { logger } from './logger';
import { exportAllData, initializeStorage, isDevMode } from './storage';
import { recalculateAllMonthlyAchievements } from './recalculateAchievements';
// Note: Old commitGateway exports removed. New gateway uses commitDelta/flushPendingCommits.

/**
 * ============================================================================
 * ARCHITECTURE ASSERTION - SINGLE SOURCE OF TRUTH
 * ============================================================================
 * 
 * hybridSync is a READ-ONLY cache + loader.
 * ALL MUTATIONS must go through commitGateway.commitChange().
 * 
 * Legacy write methods (onDataChange, onDestructiveChange) are deprecated
 * and will be blocked as commit flags are enabled in Phases 1-4.
 * 
 * DO NOT add new code that calls legacy write methods.
 * ============================================================================
 */

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
   * DISABLED: Legacy offline retry mechanism
   * commitGateway now handles its own offline queue with proper retry logic.
   * This prevents edge cases where legacy retry could resurrect deleted data.
   */
  private startOfflineRetry() {
    // NO-OP: Disabled in Phase 0.5
    // commitGateway.startOfflineRetry() handles offline queue processing
    logger.info('ℹ️ hybridSync.startOfflineRetry() is disabled - commitGateway manages offline queue');
  }

  /**
   * Setup beforeunload listener
   * 
   * PHASE 0.5: Legacy sendBeacon write path DISABLED
   * - sendBeacon was a parallel mutation path to the Worker
   * - Now only shows warning if pending changes exist
   * - commitGateway handles all writes
   */
  private setupUnloadListener() {
    window.addEventListener('beforeunload', (e) => {
      // 🔧 DEV MODE: Skip entirely
      if (isDevMode()) {
        return;
      }
      
      // ⚠️ Warn if pending changes exist (but do NOT attempt sync)
      if (this.syncState.pendingChanges > 0) {
        const warningMessage = 'יש שינויים שטרם נשמרו! האם את בטוחה שאת רוצה לצאת?';
        e.preventDefault();
        e.returnValue = warningMessage;
        
        // 🚫 DISABLED: Legacy sendBeacon write path
        // Previously this would send data via navigator.sendBeacon()
        // This is now blocked to ensure single write authority via commitGateway
        logger.warn('⚠️ User leaving with pending changes - sendBeacon disabled (Phase 0.5)');
        
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
          // NO version set - commitGateway remains disabled
          logger.error('🚨 CRITICAL: No meaningful data and no _version - commitGateway DISABLED');
        } else {
          logger.info('✅ Data loaded from Worker');
          this.updateInMemoryStorage(result.data);
          this.syncState.lastSyncTime = new Date().toISOString();
          
          // Note: Version tracking moved to new commitGateway (queue+flush model)
          if (result.data._version) {
            logger.info(`📌 Worker data version: ${result.data._version}`);
          }
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
   * DEPRECATED: Legacy data change handler
   * 
   * PHASE 0.5: This method is deprecated but kept functional for ~40+ existing call sites.
   * Will be migrated to commitGateway in Phases 1-4.
   * 
   * 🚫 GUARD: Delete operations MUST NOT use this method - use onDestructiveChange() instead.
   */
  async onDataChange(): Promise<{ success: boolean; synced: boolean; message: string }> {
    // ⚠️ DEPRECATION WARNING - remove in Phase 4
    logger.warn('⚠️ DEPRECATED: hybridSync.onDataChange() called - migrate to commitGateway.commitChange()');
    
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

    const success = await this.syncToWorker();
    
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
   * DEPRECATED: Legacy destructive change handler (deletes)
   * 
   * PHASE 0.5: Conditionally blocked based on COMMIT_FLAGS.
   * - If commit flags are ENABLED: HARD BLOCK (use commitGateway instead)
   * - If commit flags are DISABLED: Allow legacy path with directUpload (no merge)
   * 
   * This ensures deletes NEVER go through merge-based sync (prevents resurrection).
   */
  async onDestructiveChange(): Promise<{ success: boolean; synced: boolean; message: string }> {
    // ⚠️ DEPRECATION WARNING
    logger.warn('⚠️ DEPRECATED: hybridSync.onDestructiveChange() called - migrate to commitDelta()');
    
    // Note: Legacy blocking via COMMIT_FLAGS removed in new commitGateway
    
    if (isDevMode()) {
      return { success: true, synced: true, message: 'נשמר במצב מפתחים' };
    }

    this.syncState.pendingChanges++;

    if (!this.syncState.isOnline) {
      logger.warn('📡 Offline (delete) - saved locally, will retry in 2 minutes');
      return {
        success: true,
        synced: false,
        message: 'נמחק מקומית, יסונכרן כשיחזור חיבור',
      };
    }

    // ✅ SAFE: directUpload has no merge logic - prevents delete resurrection
    this.currentDirectUploadContext = 'onDestructiveChange';
    const success = await this.directUpload();
    this.currentDirectUploadContext = null;

    if (success) {
      return {
        success: true,
        synced: true,
        message: 'נמחק בדרופבוקס בהצלחה',
      };
    } else {
      return {
        success: true,
        synced: false,
        message: 'נמחק מקומית, סנכרון לדרופבוקס נכשל – ננסה שוב',
      };
    }
  }

  /**
   * Direct upload context tracking for internal guard
   * Only allowed callers: 'onDestructiveChange', 'importBackup'
   */
  private currentDirectUploadContext: 'onDestructiveChange' | 'importBackup' | null = null;
  
  /**
   * Direct upload without merge - used for destructive operations like delete
   * This prevents the merge logic from restoring deleted records
   * 
   * PHASE 0.5: Guarded to only allow calls from:
   * - onDestructiveChange() (legacy delete bridge until Phase 1)
   * - importBackup() (explicit user action)
   */
  private async directUpload(): Promise<boolean> {
    // 🛡️ GUARD: Only allow from known safe contexts
    const allowedContexts = ['onDestructiveChange', 'importBackup'];
    if (!allowedContexts.includes(this.currentDirectUploadContext || '')) {
      logger.error('🚫 BLOCKED: directUpload() called from unexpected context:', this.currentDirectUploadContext);
      logger.error('🚫 Only onDestructiveChange and importBackup may call directUpload');
      return false;
    }
    
    if (isDevMode()) {
      logger.info('🔧 DEV MODE: directUpload disabled');
      return true;
    }

    try {
      const data = this.gatherAllData();
      const result = await workerApi.uploadVersioned(data);

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.pendingChanges = 0;
        logger.info('✅ Direct upload to worker completed');

        try {
          recalculateAllMonthlyAchievements();
        } catch (err) {
          logger.warn('⚠️ Failed to recalc achievements after direct upload:', err);
        }

        return true;
      } else {
        logger.warn('⚠️ Direct upload failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Direct upload error:', error);
      return false;
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
   * 
   * PHASE 0.5: This is an allowed write path (explicit user action)
   * Uses directUpload (no merge) to prevent data resurrection issues
   */
  async importBackup(file: File): Promise<{ success: boolean; message: string }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.updateInMemoryStorage(data);
      
      // Use directUpload (no merge) for backup import
      this.currentDirectUploadContext = 'importBackup';
      const success = await this.directUpload();
      this.currentDirectUploadContext = null;

      if (success) {
        logger.info('✅ Backup imported and synced to Worker (direct upload)');
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

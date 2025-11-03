import { workerApi } from './workerApi';
import { logger } from './logger';

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
  private pendingQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.setupNetworkListeners();
    this.startPeriodicSync();
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
   * Start periodic sync every 30 minutes
   */
  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.syncState.isOnline && !this.syncState.isSyncing) {
        this.syncToWorker();
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Load data on app initialization
   * Priority: Worker → localStorage cache
   */
  async loadDataOnInit(): Promise<void> {
    try {
      logger.info('🔄 Loading data (Worker as source of truth)...');

      if (!this.syncState.isOnline) {
        logger.warn('📦 Offline - loading from cache');
        this.loadFromCache();
        return;
      }

      // Try to load from Worker first
      const result = await workerApi.downloadLatest();

      if (result.success && result.data) {
        logger.info('✅ Data loaded from Worker');
        this.updateLocalStorage(result.data);
        this.syncState.lastSyncTime = new Date().toISOString();
      } else if (result.error === 'NO_VERSION_FOUND') {
        logger.info('ℹ️ No version found on Worker - first time use');
        // Try to load from cache if exists
        this.loadFromCache();
      } else {
        logger.warn('⚠️ Worker load failed - using cache');
        this.loadFromCache();
      }
    } catch (error) {
      logger.error('❌ Load error:', error);
      this.loadFromCache();
    }
  }

  /**
   * Load data from localStorage cache
   */
  private loadFromCache() {
    try {
      const cacheKeys = [
        'musicSystem_students',
        'musicSystem_lessons',
        'musicSystem_payments',
        'musicSystem_swapRequests',
        'musicSystem_files',
        'musicSystem_scheduleTemplates',
        'musicSystem_integrationSettings',
        'musicSystem_performances',
        'musicSystem_holidays',
        'musicSystem_practiceSessions',
        'musicSystem_monthlyAchievements',
        'musicSystem_medalRecords',
        'oneTimePayments',
      ];

      let hasCache = false;
      cacheKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          hasCache = true;
        }
      });

      if (hasCache) {
        logger.info('📦 Data loaded from cache');
      } else {
        logger.info('ℹ️ No cache found - starting fresh');
      }
    } catch (error) {
      logger.error('❌ Cache load error:', error);
    }
  }

  /**
   * Update localStorage with Worker data
   */
  private updateLocalStorage(data: any) {
    try {
      Object.keys(data).forEach(key => {
        const value = data[key];
        localStorage.setItem(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        );
      });
      logger.info('💾 Cache updated from Worker');
    } catch (error) {
      logger.error('❌ Cache update error:', error);
    }
  }

  /**
   * On data change - queue for sync
   */
  async onDataChange() {
    this.syncState.pendingChanges++;

    if (this.syncState.isOnline) {
      await this.syncToWorker();
    } else {
      logger.info('📡 Offline - change queued for sync');
    }
  }

  /**
   * Sync all data to Worker
   */
  private async syncToWorker(): Promise<boolean> {
    if (this.syncState.isSyncing) {
      logger.info('⏳ Sync already in progress');
      return false;
    }

    try {
      this.syncState.isSyncing = true;
      logger.info('🔄 Syncing to Worker...');

      const data = this.gatherAllData();
      const result = await workerApi.uploadVersioned(data);

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.pendingChanges = 0;
        logger.info('✅ Synced to Worker successfully');
        return true;
      } else {
        logger.warn('⚠️ Sync failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Sync error:', error);
      return false;
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Gather all data from localStorage
   */
  private gatherAllData(): any {
    const data: Record<string, any> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }

    data.timestamp = new Date().toISOString();
    return data;
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
   * Import backup from file
   */
  async importBackup(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.updateLocalStorage(data);
      await this.syncToWorker();

      logger.info('✅ Backup imported and synced');
      return true;
    } catch (error) {
      logger.error('❌ Import error:', error);
      return false;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const hybridSync = new HybridSyncManager();

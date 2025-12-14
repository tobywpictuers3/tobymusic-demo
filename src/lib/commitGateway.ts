/**
 * Commit Gateway - Single pipeline for all DB mutations
 * 
 * ARCHITECTURE:
 * - All mutations MUST go through commitChange()
 * - Worker is the ONLY source of truth
 * - UI NEVER updates until Worker confirms (confirmed: true)
 * - Offline operations are queued (queued: true, confirmed: false)
 * 
 * VERSIONING:
 * - currentVersion is initialized from Worker on loadDataOnInit
 * - Every commit includes baseVersion
 * - Worker returns 409 on version mismatch
 * - On conflict: reload from Worker, retry or abort
 */

import { workerApi } from './workerApi';
import { logger } from './logger';
import { isDevMode } from './devMode';
import { 
  EntityType, 
  DB_REGISTRY, 
  DB_REGISTRY_VERSION,
  getEntityDefinition,
  isRegisteredEntity,
} from './dbRegistry';

// ============================================================================
// TYPES
// ============================================================================

export interface CommitResult {
  /** Worker confirmed persistence - UI can update */
  confirmed: boolean;
  /** Mutation is queued for later sync - NOT confirmed */
  queued: boolean;
  /** Error message if failed */
  error?: string;
  /** New version from Worker (only if confirmed) */
  newVersion?: string;
  /** Returned data (for create operations) */
  data?: any;
}

export interface DeltaPayload {
  entity: EntityType;
  action: 'create' | 'update' | 'delete';
  id?: string;
  payload?: any;
  baseVersion: string;
  registryVersion: string;
}

interface QueuedCommit {
  delta: DeltaPayload;
  resolve: (result: CommitResult) => void;
  retryCount: number;
}

// ============================================================================
// STATE
// ============================================================================

/**
 * Current version - MUST be initialized from Worker
 * null = not initialized, commits will fail
 */
let currentVersion: string | null = null;

/**
 * Offline queue - commits waiting to be sent when online
 */
const offlineQueue: QueuedCommit[] = [];

/**
 * Feature flags for phased rollout
 * All false initially - will be enabled in phases
 */
export const COMMIT_FLAGS = {
  /** Phase 1: Enable for cascade deletes (deleteStudentCascade, deleteLessonCascade) */
  cascadeDeletes: false,
  /** Phase 2: Enable for all delete operations */
  allDeletes: false,
  /** Phase 3: Enable for update operations */
  updates: false,
  /** Phase 4: Enable for create operations */
  creates: false,
};

const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 30000; // 30 seconds

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Initialize current version from Worker response
 * Called by hybridSync.loadDataOnInit()
 */
export function setCurrentVersion(version: string): void {
  currentVersion = version;
  logger.info(`📌 Commit Gateway: Version initialized to ${version}`);
}

/**
 * Get current version (for debugging/display)
 */
export function getCurrentVersion(): string | null {
  return currentVersion;
}

/**
 * Check if version is initialized
 */
export function isVersionInitialized(): boolean {
  return currentVersion !== null;
}

// ============================================================================
// OFFLINE QUEUE MANAGEMENT
// ============================================================================

let retryIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the offline retry mechanism
 */
export function startOfflineRetry(): void {
  if (retryIntervalId) return;
  
  retryIntervalId = setInterval(async () => {
    if (offlineQueue.length > 0 && navigator.onLine) {
      logger.info(`🔄 Commit Gateway: Processing ${offlineQueue.length} queued commits...`);
      await processOfflineQueue();
    }
  }, RETRY_INTERVAL_MS);
}

/**
 * Stop the offline retry mechanism
 */
export function stopOfflineRetry(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
}

/**
 * Process queued commits when back online
 */
async function processOfflineQueue(): Promise<void> {
  while (offlineQueue.length > 0) {
    const item = offlineQueue[0];
    
    try {
      const result = await sendCommitToWorker(item.delta);
      
      if (result.confirmed) {
        // Success - remove from queue and resolve
        offlineQueue.shift();
        item.resolve(result);
      } else if (result.error === 'VERSION_CONFLICT') {
        // Conflict - need to reload, can't auto-resolve
        offlineQueue.shift();
        item.resolve({ 
          confirmed: false, 
          queued: false, 
          error: 'VERSION_CONFLICT: Reload required to resolve' 
        });
      } else {
        // Other error - retry or fail
        item.retryCount++;
        if (item.retryCount >= MAX_RETRY_COUNT) {
          offlineQueue.shift();
          item.resolve({ 
            confirmed: false, 
            queued: false, 
            error: `Failed after ${MAX_RETRY_COUNT} retries: ${result.error}` 
          });
        } else {
          // Leave in queue for next retry
          break;
        }
      }
    } catch (err) {
      // Network error - stop processing, will retry later
      logger.warn('⚠️ Commit Gateway: Network error during queue processing, will retry');
      break;
    }
  }
}

/**
 * Get current queue length (for UI display)
 */
export function getPendingCommitCount(): number {
  return offlineQueue.length;
}

// ============================================================================
// CORE COMMIT FUNCTION
// ============================================================================

/**
 * Send a single commit to the Worker
 */
async function sendCommitToWorker(delta: DeltaPayload): Promise<CommitResult> {
  try {
    const response = await workerApi.commitDelta(delta);
    
    if (response.ok && response.newVersion) {
      // Update local version
      currentVersion = response.newVersion;
      
      return {
        confirmed: true,
        queued: false,
        newVersion: response.newVersion,
        data: response.data,
      };
    }
    
    if (response.status === 409) {
      return {
        confirmed: false,
        queued: false,
        error: 'VERSION_CONFLICT',
      };
    }
    
    return {
      confirmed: false,
      queued: false,
      error: response.error || 'Unknown error from Worker',
    };
  } catch (err) {
    throw err; // Re-throw network errors
  }
}

/**
 * Main commit function - ALL DB mutations MUST use this
 * 
 * @param params.entity - Entity type (must be registered in DB_REGISTRY)
 * @param params.action - 'create' | 'update' | 'delete'
 * @param params.id - Entity ID (required for update/delete)
 * @param params.payload - Data (required for create/update)
 * @returns CommitResult with confirmed/queued status
 */
export async function commitChange(params: {
  entity: EntityType;
  action: 'create' | 'update' | 'delete';
  id?: string;
  payload?: any;
}): Promise<CommitResult> {
  const { entity, action, id, payload } = params;
  
  // -------------------------------------------------------------------------
  // DEV MODE: Skip Worker, return success immediately
  // -------------------------------------------------------------------------
  if (isDevMode()) {
    logger.info(`🔧 DEV MODE: commitChange(${entity}, ${action}) - auto-confirmed`);
    return { confirmed: true, queued: false, data: payload };
  }
  
  // -------------------------------------------------------------------------
  // VALIDATION
  // -------------------------------------------------------------------------
  
  // Entity must be registered
  if (!isRegisteredEntity(entity)) {
    logger.error(`❌ Commit Gateway: Unknown entity type: ${entity}`);
    return { confirmed: false, queued: false, error: `Unknown entity: ${entity}` };
  }
  
  // Version must be initialized
  if (currentVersion === null) {
    logger.error('❌ Commit Gateway: Version not initialized - reload required');
    return { 
      confirmed: false, 
      queued: false, 
      error: 'Version not initialized - reload required' 
    };
  }
  
  // ID required for update/delete
  if ((action === 'update' || action === 'delete') && !id) {
    logger.error(`❌ Commit Gateway: ${action} requires id`);
    return { confirmed: false, queued: false, error: `${action} requires id` };
  }
  
  // Payload required for create/update
  if ((action === 'create' || action === 'update') && !payload) {
    logger.error(`❌ Commit Gateway: ${action} requires payload`);
    return { confirmed: false, queued: false, error: `${action} requires payload` };
  }
  
  // -------------------------------------------------------------------------
  // BUILD DELTA
  // -------------------------------------------------------------------------
  
  const delta: DeltaPayload = {
    entity,
    action,
    id,
    payload,
    baseVersion: currentVersion,
    registryVersion: DB_REGISTRY_VERSION,
  };
  
  // -------------------------------------------------------------------------
  // OFFLINE HANDLING
  // -------------------------------------------------------------------------
  
  if (!navigator.onLine) {
    logger.warn(`📡 Commit Gateway: Offline - queueing ${action} on ${entity}`);
    
    return new Promise((resolve) => {
      offlineQueue.push({ delta, resolve, retryCount: 0 });
      
      // CRITICAL: queued=true, confirmed=false
      // UI must show \"pending sync\" state, NOT confirmed state
      resolve({ confirmed: false, queued: true });
    });
  }
  
  // -------------------------------------------------------------------------
  // ONLINE: SEND TO WORKER
  // -------------------------------------------------------------------------
  
  try {
    logger.info(`🔄 Commit Gateway: ${action} on ${entity}${id ? ` (${id})` : ''}`);
    
    const result = await sendCommitToWorker(delta);
    
    if (result.confirmed) {
      logger.info(`✅ Commit Gateway: ${action} on ${entity} confirmed, v=${result.newVersion}`);
    } else {
      logger.warn(`⚠️ Commit Gateway: ${action} on ${entity} failed: ${result.error}`);
    }
    
    return result;
    
  } catch (err) {
    // Network error - queue for later
    logger.warn(`📡 Commit Gateway: Network error - queueing ${action} on ${entity}`);
    
    return new Promise((resolve) => {
      offlineQueue.push({ delta, resolve, retryCount: 0 });
      resolve({ confirmed: false, queued: true });
    });
  }
}

// ============================================================================
// FEATURE FLAG HELPERS
// ============================================================================

/**
 * Check if an action is enabled via feature flags
 */
export function isCommitEnabled(action: 'create' | 'update' | 'delete', isCascade: boolean = false): boolean {
  if (action === 'delete') {
    if (isCascade) return COMMIT_FLAGS.cascadeDeletes;
    return COMMIT_FLAGS.allDeletes;
  }
  if (action === 'update') return COMMIT_FLAGS.updates;
  if (action === 'create') return COMMIT_FLAGS.creates;
  return false;
}

// ============================================================================
// NETWORK LISTENERS
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logger.info('🌐 Commit Gateway: Back online - processing queue...');
    processOfflineQueue();
  });
  
  // Start offline retry on module load
  startOfflineRetry();
}

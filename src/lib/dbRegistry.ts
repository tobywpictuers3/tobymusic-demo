/**
 * DB Registry - Single source of truth for entity definitions
 * 
 * IMPORTANT: This is a client-side copy. The Worker maintains an authoritative
 * copy that enforces cascade/soft/hard deletion rules. The registry version
 * is used to validate client-server consistency.
 * 
 * Storage key mappings are verified against inMemoryStorage in storage.ts
 */

export const DB_REGISTRY_VERSION = '1.0.0';

export type DeleteMode = 'cascade' | 'hard' | 'soft';
export type ActionType = 'create' | 'update' | 'delete';

/**
 * Entity types - defined first to avoid circular reference
 */
export type EntityType = 
  | 'students' 
  | 'lessons' 
  | 'payments' 
  | 'swapRequests' 
  | 'files' 
  | 'scheduleTemplates' 
  | 'performances' 
  | 'holidays' 
  | 'practiceSessions' 
  | 'monthlyAchievements' 
  | 'medalRecords' 
  | 'messages' 
  | 'storeItems' 
  | 'storePurchases' 
  | 'oneTimePayments'
  | 'studentStats'
  | 'tithePaid'
  | 'integrationSettings';

export interface EntityDefinition {
  /** Key used in inMemoryStorage (e.g., 'students') */
  storageKey: string;
  /** Key used in Worker/Dropbox (e.g., 'musicSystem_students') */
  workerKey: string;
  /** How deletions are handled */
  deleteMode: DeleteMode;
  /** For soft deletes, the field that marks deletion */
  softDeleteField?: string;
  /** For cascade deletes, entities that should also be deleted */
  cascadeTargets?: EntityType[];
}

/**
 * DB_REGISTRY - All entity definitions
 * 
 * Storage keys verified from storage.ts:
 * - inMemoryStorage['students'], ['lessons'], ['payments'], etc.
 * - Worker keys use 'musicSystem_' prefix (except oneTimePayments)
 */
export const DB_REGISTRY: Record<EntityType, EntityDefinition> = {
  students: {
    storageKey: 'students',
    workerKey: 'musicSystem_students',
    deleteMode: 'cascade',
    cascadeTargets: ['lessons', 'payments', 'files', 'practiceSessions', 'monthlyAchievements', 'medalRecords', 'swapRequests'],
  },
  lessons: {
    storageKey: 'lessons',
    workerKey: 'musicSystem_lessons',
    deleteMode: 'cascade',
    cascadeTargets: ['swapRequests'],
  },
  payments: {
    storageKey: 'payments',
    workerKey: 'musicSystem_payments',
    deleteMode: 'hard',
  },
  swapRequests: {
    storageKey: 'swapRequests',
    workerKey: 'musicSystem_swapRequests',
    deleteMode: 'hard',
  },
  files: {
    storageKey: 'files',
    workerKey: 'musicSystem_files',
    deleteMode: 'hard',
  },
  scheduleTemplates: {
    storageKey: 'scheduleTemplates',
    workerKey: 'musicSystem_scheduleTemplates',
    deleteMode: 'hard',
  },
  performances: {
    storageKey: 'performances',
    workerKey: 'musicSystem_performances',
    deleteMode: 'hard',
  },
  holidays: {
    storageKey: 'holidays',
    workerKey: 'musicSystem_holidays',
    deleteMode: 'hard',
  },
  practiceSessions: {
    storageKey: 'practiceSessions',
    workerKey: 'musicSystem_practiceSessions',
    deleteMode: 'hard',
  },
  monthlyAchievements: {
    storageKey: 'monthlyAchievements',
    workerKey: 'musicSystem_monthlyAchievements',
    deleteMode: 'hard',
  },
  medalRecords: {
    storageKey: 'medalRecords',
    workerKey: 'musicSystem_medalRecords',
    deleteMode: 'hard',
  },
  messages: {
    storageKey: 'messages',
    workerKey: 'musicSystem_messages',
    deleteMode: 'soft',
    softDeleteField: 'isDeleted',
  },
  storeItems: {
    storageKey: 'storeItems',
    workerKey: 'musicSystem_storeItems',
    deleteMode: 'hard',
  },
  storePurchases: {
    storageKey: 'storePurchases',
    workerKey: 'musicSystem_storePurchases',
    deleteMode: 'hard',
  },
  oneTimePayments: {
    storageKey: 'oneTimePayments',
    workerKey: 'oneTimePayments', // No musicSystem_ prefix for this entity
    deleteMode: 'hard',
  },
  // Non-array entities (objects)
  studentStats: {
    storageKey: 'studentStats',
    workerKey: 'musicSystem_studentStats',
    deleteMode: 'hard',
  },
  tithePaid: {
    storageKey: 'tithePaid',
    workerKey: 'musicSystem_tithePaid',
    deleteMode: 'hard',
  },
  integrationSettings: {
    storageKey: 'integrationSettings',
    workerKey: 'musicSystem_integrationSettings',
    deleteMode: 'hard',
  },
};


/**
 * Get entity definition by type
 */
export function getEntityDefinition(entity: EntityType): EntityDefinition {
  return DB_REGISTRY[entity];
}

/**
 * Check if an entity type is registered
 */
export function isRegisteredEntity(entity: string): entity is EntityType {
  return entity in DB_REGISTRY;
}

/**
 * Get all registered entity types
 */
export function getAllEntityTypes(): EntityType[] {
  return Object.keys(DB_REGISTRY) as EntityType[];
}

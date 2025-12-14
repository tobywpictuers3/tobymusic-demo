/**
 * Sonata Music System - Cloudflare Worker
 * Phase A: Commit Gateway with Delta-Based Persistence
 * 
 * HARD RULES:
 * 1. download_latest ALWAYS returns _version (fixed "v_initial" if missing)
 * 2. commit_delta is the ONLY place that generates/persists versions
 * 3. applyCreate generates server-authoritative IDs if not provided
 * 4. Cascade deletes use explicit foreignKey definitions only
 * 5. Worker DB_REGISTRY is authoritative - client cannot override
 */

// ============================================================================
// TYPES
// ============================================================================

type DeleteMode = 'cascade' | 'hard' | 'soft';
type ActionType = 'create' | 'update' | 'delete';

interface CascadeTarget {
  entity: EntityType;
  foreignKey: string;
}

interface EntityDefinition {
  workerKey: string;
  deleteMode: DeleteMode;
  softDeleteField?: string;
  cascadeTargets?: CascadeTarget[];
}

type EntityType = 
  | 'students' | 'lessons' | 'payments' | 'swapRequests' | 'files'
  | 'scheduleTemplates' | 'performances' | 'holidays' | 'practiceSessions'
  | 'monthlyAchievements' | 'medalRecords' | 'messages' | 'storeItems'
  | 'storePurchases' | 'oneTimePayments' | 'studentStats' | 'tithePaid'
  | 'integrationSettings';

interface DeltaPayload {
  entity: EntityType;
  action: ActionType;
  id?: string;
  payload?: Record<string, any>;
  baseVersion: string;
}

interface AuditEntry {
  timestamp: string;
  entity: EntityType;
  action: ActionType;
  id: string;
  baseVersion: string;
  newVersion: string;
  managerCodeHash: string;
}

interface CommitDeltaResponse {
  ok: boolean;
  newVersion?: string;
  error?: string;
  currentVersion?: string;
  data?: Record<string, any>;   // client-friendly
  record?: Record<string, any>; // keep existing
}

// ============================================================================
// SERVER-AUTHORITATIVE DB_REGISTRY
// ============================================================================

const DB_REGISTRY: Record<EntityType, EntityDefinition> = {
  students: {
    workerKey: 'musicSystem_students',
    deleteMode: 'cascade',
    cascadeTargets: [
      { entity: 'lessons', foreignKey: 'studentId' },
      { entity: 'payments', foreignKey: 'studentId' },
      { entity: 'files', foreignKey: 'studentId' },
      { entity: 'practiceSessions', foreignKey: 'studentId' },
      { entity: 'monthlyAchievements', foreignKey: 'studentId' },
      { entity: 'medalRecords', foreignKey: 'studentId' },
      // swapRequests: delete if student is requester OR target (new + legacy shapes)
      { entity: 'swapRequests', foreignKey: 'requesterStudentId' },
      { entity: 'swapRequests', foreignKey: 'targetStudentId' },
      { entity: 'swapRequests', foreignKey: 'requesterId' },
      { entity: 'swapRequests', foreignKey: 'targetId' },
    ],
  },
  lessons: {
    workerKey: 'musicSystem_lessons',
    deleteMode: 'cascade',
    cascadeTargets: [
      { entity: 'swapRequests', foreignKey: 'lessonId' },
    ],
  },
  payments: {
    workerKey: 'musicSystem_payments',
    deleteMode: 'hard',
  },
  swapRequests: {
    workerKey: 'musicSystem_swapRequests',
    deleteMode: 'hard',
  },
  files: {
    workerKey: 'musicSystem_files',
    deleteMode: 'hard',
  },
  scheduleTemplates: {
    workerKey: 'musicSystem_scheduleTemplates',
    deleteMode: 'hard',
  },
  performances: {
    workerKey: 'musicSystem_performances',
    deleteMode: 'hard',
  },
  holidays: {
    workerKey: 'musicSystem_holidays',
    deleteMode: 'hard',
  },
  practiceSessions: {
    workerKey: 'musicSystem_practiceSessions',
    deleteMode: 'hard',
  },
  monthlyAchievements: {
    workerKey: 'musicSystem_monthlyAchievements',
    deleteMode: 'hard',
  },
  medalRecords: {
    workerKey: 'musicSystem_medalRecords',
    deleteMode: 'hard',
  },
  messages: {
    workerKey: 'musicSystem_messages',
    deleteMode: 'soft',
    softDeleteField: 'isDeleted',
  },
  storeItems: {
    workerKey: 'musicSystem_storeItems',
    deleteMode: 'hard',
  },
  storePurchases: {
    workerKey: 'musicSystem_storePurchases',
    deleteMode: 'hard',
  },
  oneTimePayments: {
    workerKey: 'oneTimePayments', // No musicSystem_ prefix
    deleteMode: 'hard',
  },
  studentStats: {
    workerKey: 'musicSystem_studentStats',
    deleteMode: 'hard',
  },
  tithePaid: {
    workerKey: 'musicSystem_tithePaid',
    deleteMode: 'hard',
  },
  integrationSettings: {
    workerKey: 'musicSystem_integrationSettings',
    deleteMode: 'hard',
  },
};

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

const INITIAL_VERSION = 'v_initial';

function generateVersion(): string {
  const timestamp = Date.now();
  const randomHash = Math.random().toString(36).substring(2, 10);
  return `v_${timestamp}_${randomHash}`;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function hashManagerCode(code: string): string {
  // Simple hash for audit purposes (not cryptographic)
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

// ============================================================================
// DROPBOX API HELPERS
// ============================================================================

interface Env {
  DROPBOX_ACCESS_TOKEN: string;
  MANAGER_CODE: string;
}

const DATA_PATH = '/sonata/data.json';
const AUDIT_LOG_PATH = '/sonata/audit_log.jsonl';

async function dropboxDownload(env: Env, path: string): Promise<any | null> {
  try {
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (response.status === 409) {
      // File not found
      return null;
    }

    if (!response.ok) {
      throw new Error(`Dropbox download failed: ${response.status}`);
    }

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Dropbox download error for ${path}:`, error);
    return null;
  }
}

async function dropboxUpload(env: Env, path: string, data: any): Promise<boolean> {
  try {
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: JSON.stringify(data, null, 2),
    });

    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error(`Dropbox upload error for ${path}:`, error);
    return false;
  }
}

async function dropboxAppendAuditLog(env: Env, entry: AuditEntry): Promise<void> {
  try {
    // Download existing audit log
    let existingLog = '';
    try {
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
          'Dropbox-API-Arg': JSON.stringify({ path: AUDIT_LOG_PATH }),
        },
      });
      if (response.ok) {
        existingLog = await response.text();
      }
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Append new entry
    const newLog = existingLog + JSON.stringify(entry) + '\n';

    await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: AUDIT_LOG_PATH,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: newLog,
    });
  } catch (error) {
    console.error('Audit log append error:', error);
    // Don't fail the commit if audit log fails
  }
}

// ============================================================================
// DELTA APPLICATION FUNCTIONS
// ============================================================================

function getEntityArray(data: any, entity: EntityType): any[] {
  const workerKey = DB_REGISTRY[entity].workerKey;
  if (!data[workerKey]) {
    data[workerKey] = [];
  }
  return data[workerKey];
}

function applyCreate(
  data: any,
  entity: EntityType,
  payload: Record<string, any>,
  providedId?: string
): { success: boolean; record?: Record<string, any>; error?: string } {
  const arr = getEntityArray(data, entity);
  
  // Server-authoritative ID generation
  const id = providedId || generateId();
  
  // Check for duplicate ID
  if (arr.some((item: any) => item.id === id)) {
    return { success: false, error: `Duplicate ID: ${id}` };
  }

  const record = { ...payload, id };
  arr.push(record);

  console.log(`[applyCreate] ${entity} id=${id}`);
  return { success: true, record };
}

function applyUpdate(
  data: any,
  entity: EntityType,
  id: string,
  payload: Record<string, any>
): { success: boolean; error?: string } {
  const arr = getEntityArray(data, entity);
  const index = arr.findIndex((item: any) => item.id === id);

  if (index === -1) {
    return { success: false, error: `Record not found: ${entity}/${id}` };
  }

  // Merge payload into existing record
  arr[index] = { ...arr[index], ...payload, id }; // Ensure ID is preserved

  console.log(`[applyUpdate] ${entity} id=${id}`);
  return { success: true };
}

function applyHardDelete(
  data: any,
  entity: EntityType,
  id: string
): { success: boolean; error?: string } {
  const arr = getEntityArray(data, entity);
  const index = arr.findIndex((item: any) => item.id === id);

  if (index === -1) {
    // Record already deleted or never existed - treat as success
    console.log(`[applyHardDelete] ${entity} id=${id} (not found, treating as success)`);
    return { success: true };
  }

  arr.splice(index, 1);
  console.log(`[applyHardDelete] ${entity} id=${id}`);
  return { success: true };
}

function applySoftDelete(
  data: any,
  entity: EntityType,
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const definition = DB_REGISTRY[entity];
  if (!definition.softDeleteField) {
    return { success: false, error: `No softDeleteField defined for ${entity}` };
  }

  const arr = getEntityArray(data, entity);
  const index = arr.findIndex((item: any) => item.id === id);

  if (index === -1) {
    return { success: false, error: `Record not found: ${entity}/${id}` };
  }

  // Set soft delete flag for this user
  if (!arr[index][definition.softDeleteField]) {
    arr[index][definition.softDeleteField] = {};
  }
  arr[index][definition.softDeleteField][userId] = true;

  console.log(`[applySoftDelete] ${entity} id=${id} userId=${userId}`);
  return { success: true };
}

function applyCascadeDelete(
  data: any,
  entity: EntityType,
  id: string
): { success: boolean; error?: string; deletedCounts?: Record<string, number> } {
  const definition = DB_REGISTRY[entity];
  const deletedCounts: Record<string, number> = {};

  // First, delete cascaded entities using EXPLICIT foreignKey definitions
  if (definition.cascadeTargets) {
    for (const target of definition.cascadeTargets) {
      const targetArr = getEntityArray(data, target.entity);
      const toDelete = targetArr.filter((item: any) => item[target.foreignKey] === id);
      
      let count = 0;
      for (const item of toDelete) {
        // Recursively apply delete based on target's deleteMode
        const targetDef = DB_REGISTRY[target.entity];
        if (targetDef.deleteMode === 'cascade') {
          applyCascadeDelete(data, target.entity, item.id);
        } else {
          applyHardDelete(data, target.entity, item.id);
        }
        count++;
      }
      
      if (count > 0) {
        deletedCounts[target.entity] = count;
        console.log(`[applyCascadeDelete] Deleted ${count} ${target.entity} records with ${target.foreignKey}=${id}`);
      }
    }
  }

  // Then delete the primary record
  const result = applyHardDelete(data, entity, id);
  if (result.success) {
    deletedCounts[entity] = 1;
  }

  return { success: result.success, error: result.error, deletedCounts };
}

function applyDelete(
  data: any,
  entity: EntityType,
  id: string,
  userId?: string
): { success: boolean; error?: string; deletedCounts?: Record<string, number> } {
  const definition = DB_REGISTRY[entity];

  // Server-authoritative deleteMode - client cannot override
  switch (definition.deleteMode) {
    case 'cascade':
      return applyCascadeDelete(data, entity, id);
    case 'soft':
      if (!userId) {
        return { success: false, error: 'userId required for soft delete' };
      }
      return applySoftDelete(data, entity, id, userId);
    case 'hard':
    default:
      return applyHardDelete(data, entity, id);
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleDownloadLatest(env: Env): Promise<Response> {
  const data = await dropboxDownload(env, DATA_PATH);

  if (!data) {
    // No data exists yet - return empty structure with INITIAL_VERSION
    // HARD RULE: Never persist, never generate new version
    return new Response(JSON.stringify({
      success: true,
      data: { _version: INITIAL_VERSION },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // HARD RULE: ALWAYS return _version
  // If missing, return fixed "v_initial" - do NOT generate or persist
  if (!data._version) {
    data._version = INITIAL_VERSION;
  }

  return new Response(JSON.stringify({
    success: true,
    data,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleCommitDelta(
  env: Env,
  delta: DeltaPayload,
  managerCode: string
): Promise<Response> {
  console.log(`[commit_delta] entity=${delta.entity} action=${delta.action} id=${delta.id} baseVersion=${delta.baseVersion}`);

  // Validate entity
  if (!DB_REGISTRY[delta.entity]) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Unknown entity: ${delta.entity}`,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load current data
  let data = await dropboxDownload(env, DATA_PATH);
  if (!data) {
    data = { _version: INITIAL_VERSION };
  }

  const currentVersion = data._version || INITIAL_VERSION;

  // STRICT VERSION CHECK
  if (delta.baseVersion !== currentVersion) {
    console.log(`[commit_delta] VERSION_CONFLICT: expected=${delta.baseVersion} actual=${currentVersion}`);
    return new Response(JSON.stringify({
      ok: false,
      error: 'VERSION_CONFLICT',
      currentVersion,
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Apply delta based on action
  let result: { success: boolean; error?: string; record?: Record<string, any>; deletedCounts?: Record<string, number> };
  let finalId = delta.id;

  switch (delta.action) {
    case 'create':
      if (!delta.payload) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'payload required for create action',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      result = applyCreate(data, delta.entity, delta.payload, delta.id);
      if (result.record) {
        finalId = result.record.id;
      }
      break;

    case 'update':
      if (!delta.id) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'id required for update action',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!delta.payload) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'payload required for update action',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      result = applyUpdate(data, delta.entity, delta.id, delta.payload);
      break;

    case 'delete':
      if (!delta.id) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'id required for delete action',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // For soft delete, userId comes from payload
      const userId = delta.payload?.userId;
      result = applyDelete(data, delta.entity, delta.id, userId);
      break;

    default:
      return new Response(JSON.stringify({
        ok: false,
        error: `Unknown action: ${delta.action}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }

  if (!result.success) {
    return new Response(JSON.stringify({
      ok: false,
      error: result.error,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate new version - ONLY place this happens
  const newVersion = generateVersion();
  data._version = newVersion;

  // Persist to Dropbox
  const uploaded = await dropboxUpload(env, DATA_PATH, data);
  if (!uploaded) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Failed to persist to storage',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Append to audit log
  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    entity: delta.entity,
    action: delta.action,
    id: finalId || '',
    baseVersion: delta.baseVersion,
    newVersion,
    managerCodeHash: hashManagerCode(managerCode),
  };
  await dropboxAppendAuditLog(env, auditEntry);

  console.log(`[commit_delta] SUCCESS: ${delta.entity}/${finalId} version=${newVersion}`);

  // Build response
  const response: CommitDeltaResponse = {
    ok: true,
    newVersion,
  };

  // For create actions, include the created record with server-generated ID
  if (delta.action === 'create' && result.record) {
    response.data = result.record;   // client-friendly
    response.record = result.record; // keep existing
  }

  // For cascade deletes, include counts
  if (delta.action === 'delete' && result.deletedCounts) {
    (response as any).deletedCounts = result.deletedCounts;
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sonata-Manager-Code',
};

// ============================================================================
// MAIN WORKER HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    try {
      // download_latest - no auth required for read
      if (action === 'download_latest' && request.method === 'GET') {
        const response = await handleDownloadLatest(env);
        return addCorsHeaders(response);
      }

      // commit_delta - requires manager code auth
      if (action === 'commit_delta' && request.method === 'POST') {
        // Validate manager code
        const managerCode = 
          request.headers.get('X-Sonata-Manager-Code') || 
          url.searchParams.get('managerCode');

        if (!managerCode || managerCode !== env.MANAGER_CODE) {
          return addCorsHeaders(new Response(JSON.stringify({
            ok: false,
            error: 'Unauthorized',
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        const delta: DeltaPayload = await request.json();
        const response = await handleCommitDelta(env, delta, managerCode);
        return addCorsHeaders(response);
      }

      // Unknown action
      return addCorsHeaders(new Response(JSON.stringify({
        error: `Unknown action: ${action}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));

    } catch (error) {
      console.error('Worker error:', error);
      return addCorsHeaders(new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
  },
};

function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

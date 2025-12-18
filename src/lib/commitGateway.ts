// commitGateway.tsx
// Queue + Flush commit gateway (UI-first)
// - UI applies changes locally immediately
// - commit_delta ONLY enqueues on Dropbox (/sonata-pending-commits.json)
// - flush_commits applies queued ops to /sonata-latest.json and bumps _version
//
// This module keeps a tiny local "outbox" so UI remains usable offline:
// 1) commitDelta() records op locally
// 2) it tries to send to Worker (commit_delta). If it fails -> stays local
// 3) flushPendingCommits() first replays local ops to Worker, then calls flush_commits
//
// Exports (kept stable):
// - isCommitEnabled()
// - commitDelta(...)
// - flushPendingCommits()

export const COMMIT_FLAGS = {};

export type DeltaAction = "create" | "update" | "delete";

// Keep entity as string to avoid tight coupling; Worker uses `musicSystem_${entity}`.
export type EntityType = string;

export type CommitState = "local" | "queued" | "flushed" | "error";

export type CommitResult = {
  ok: boolean;
  state: CommitState;
  opId?: string;
  queueLength?: number;
  lastFlushedAt?: number;
  newVersion?: string;
  error?: string;
  details?: any;
};

type LocalOp = {
  opId: string;
  receivedAt: number;
  entity: string;
  action: DeltaAction;
  id: string | null;
  payload: any | null;
  baseVersion: string | null;
  // workerAck indicates op is confirmed to be persisted in worker queue
  workerAck?: boolean;
};

const LS_KEY_OUTBOX = "sonata_commit_outbox_v1";
const LS_KEY_WORKER_URL = "sonata_worker_url";
const LS_KEY_MANAGER_CODE = "sonata_manager_code";

let workerUrlOverride: string | null = null;

// Optional: allow app to set URL without localStorage (non-exported by default).
function getWorkerBaseUrl(): string | null {
  // 1) explicit override (if some app code sets it via window)
  const w = (globalThis as any);
  if (typeof w.__SONATA_WORKER_URL__ === "string" && w.__SONATA_WORKER_URL__.trim()) {
    return w.__SONATA_WORKER_URL__.trim();
  }
  // 2) local override in this module (not currently exported)
  if (workerUrlOverride && workerUrlOverride.trim()) return workerUrlOverride.trim();
  // 3) localStorage
  try {
    const v = localStorage.getItem(LS_KEY_WORKER_URL);
    if (v && v.trim()) return v.trim();
  } catch {}
  return null;
}

function getManagerCode(): string | null {
  const w = (globalThis as any);
  if (typeof w.__SONATA_MANAGER_CODE__ === "string" && w.__SONATA_MANAGER_CODE__.trim()) {
    return w.__SONATA_MANAGER_CODE__.trim();
  }
  try {
    const v = localStorage.getItem(LS_KEY_MANAGER_CODE);
    if (v && v.trim()) return v.trim();
  } catch {}
  return null;
}

function now() {
  return Date.now();
}

function uuid(): string {
  // browser crypto preferred
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `op_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
}

function loadOutbox(): LocalOp[] {
  try {
    const raw = localStorage.getItem(LS_KEY_OUTBOX);
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return j.filter(Boolean);
  } catch {
    return [];
  }
}

function saveOutbox(items: LocalOp[]) {
  try {
    localStorage.setItem(LS_KEY_OUTBOX, JSON.stringify(items));
  } catch {
    // ignore (private browsing / quota)
  }
}

function pushToOutbox(op: LocalOp) {
  const items = loadOutbox();
  // idempotency by opId
  if (items.some((x) => x && x.opId === op.opId)) return;
  items.push(op);
  saveOutbox(items);
}

function markAcked(opId: string) {
  const items = loadOutbox();
  let changed = false;
  for (const it of items) {
    if (it && it.opId === opId && !it.workerAck) {
      it.workerAck = true;
      changed = true;
    }
  }
  if (changed) saveOutbox(items);
}

function dropAckedOps() {
  const items = loadOutbox();
  const remaining = items.filter((x) => !(x && x.workerAck));
  if (remaining.length !== items.length) saveOutbox(remaining);
}

async function postJson(url: string, body: any, headers: Record<string, string>, keepalive = false) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    keepalive,
  } as any);
  const t = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(t);
  } catch {
    j = { ok: false, error: t || `HTTP_${r.status}` };
  }
  if (!r.ok) {
    const msg = j?.error || j?.message || `HTTP_${r.status}`;
    throw new Error(msg);
  }
  return j;
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const mc = getManagerCode();
  if (mc) h["X-Sonata-Manager-Code"] = mc;
  return h;
}

async function sendCommitToWorker(op: LocalOp): Promise<CommitResult> {
  const base = getWorkerBaseUrl();
  if (!base) {
    return { ok: false, state: "error", opId: op.opId, error: "MISSING_WORKER_URL" };
  }

  const url = `${base}?action=commit_delta`;
  const payload = {
    entity: op.entity,
    action: op.action,
    id: op.id,
    payload: op.payload,
    baseVersion: op.baseVersion,
    opId: op.opId,
  };

  try {
    const res = await postJson(url, payload, buildHeaders());
    // Expect: { ok:true, state:"queued", opId, queueLength, lastFlushedAt }
    return {
      ok: !!res?.ok,
      state: (res?.state as CommitState) || "queued",
      opId: res?.opId || op.opId,
      queueLength: typeof res?.queueLength === "number" ? res.queueLength : undefined,
      lastFlushedAt: typeof res?.lastFlushedAt === "number" ? res.lastFlushedAt : undefined,
    };
  } catch (e: any) {
    return { ok: false, state: "error", opId: op.opId, error: e?.message || String(e) };
  }
}

async function callQueueStatus(): Promise<CommitResult> {
  const base = getWorkerBaseUrl();
  if (!base) return { ok: false, state: "error", error: "MISSING_WORKER_URL" };
  const url = `${base}?action=queue_status`;
  try {
    const r = await fetch(url, { headers: buildHeaders() });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || `HTTP_${r.status}`);
    return {
      ok: true,
      state: "queued",
      queueLength: typeof j?.queueLength === "number" ? j.queueLength : 0,
      lastFlushedAt: typeof j?.lastFlushedAt === "number" ? j.lastFlushedAt : 0,
    };
  } catch (e: any) {
    return { ok: false, state: "error", error: e?.message || String(e) };
  }
}

async function callFlush(keepalive = false): Promise<CommitResult> {
  const base = getWorkerBaseUrl();
  if (!base) return { ok: false, state: "error", error: "MISSING_WORKER_URL" };
  const url = `${base}?action=flush_commits`;

  try {
    const res = await postJson(url, {}, buildHeaders(), keepalive);
    // Expect: { ok:true, flushed, newVersion, queueLength, lastFlushedAt }
    return {
      ok: !!res?.ok,
      state: res?.ok ? "flushed" : "error",
      newVersion: res?.newVersion,
      queueLength: typeof res?.queueLength === "number" ? res.queueLength : undefined,
      lastFlushedAt: typeof res?.lastFlushedAt === "number" ? res.lastFlushedAt : undefined,
      error: res?.ok ? undefined : res?.error,
      details: res?.details,
    };
  } catch (e: any) {
    return { ok: false, state: "error", error: e?.message || String(e) };
  }
}

/**
 * Whether commit system is enabled (i.e., has Worker URL).
 * This matches UI needs for showing the "saving" indicator.
 */
export function isCommitEnabled(): boolean {
  return !!getWorkerBaseUrl();
}

/**
 * UI-first commit.
 * Returns immediately with {state:"local"} (caller can show 🟡),
 * and the background send will try to enqueue to worker (state:"queued").
 *
 * If you want to force sync feedback, call flushPendingCommits() afterwards.
 */
export async function commitDelta(
  entity: EntityType,
  action: DeltaAction,
  id: string | null,
  payload: any,
  baseVersion: string | null = null,
  opId: string | null = null
): Promise<CommitResult> {
  const op: LocalOp = {
    opId: (opId || uuid()).toString(),
    receivedAt: now(),
    entity,
    action,
    id: action === "create" ? (id || null) : (id || null),
    payload: payload ?? null,
    baseVersion: typeof baseVersion === "string" ? baseVersion : null,
    workerAck: false,
  };

  // Always store locally first (UI is allowed to proceed).
  pushToOutbox(op);

  // Try enqueue to Worker (best-effort).
  const workerRes = await sendCommitToWorker(op);
  if (workerRes.ok) {
    markAcked(op.opId);
    // We still return as "local" from the UX perspective; caller can ignore.
    return {
      ok: true,
      state: "local",
      opId: op.opId,
      queueLength: workerRes.queueLength,
      lastFlushedAt: workerRes.lastFlushedAt,
    };
  }

  return {
    ok: true,
    state: "local",
    opId: op.opId,
    queueLength: loadOutbox().length,
    error: workerRes.error || "ENQUEUE_FAILED",
  };
}

/**
 * Flush all pending commits:
 * 1) Replay any local ops that were not acked into Worker queue
 * 2) Call flush_commits on Worker
 * 3) Refresh queue_status
 */
export async function flushPendingCommits(options?: { keepalive?: boolean }): Promise<CommitResult> {
  const keepalive = !!options?.keepalive;

  // Step 1: replay local non-acked ops
  const outbox = loadOutbox();
  for (const op of outbox) {
    if (!op || op.workerAck) continue;
    const res = await sendCommitToWorker(op);
    if (res.ok) {
      markAcked(op.opId);
    } else {
      // still offline; stop early
      return {
        ok: false,
        state: "error",
        error: res.error || "ENQUEUE_FAILED",
        queueLength: outbox.length,
      };
    }
  }

  // Step 2: flush server queue -> sonata-latest.json
  const flushRes = await callFlush(keepalive);
  if (!flushRes.ok) return flushRes;

  // Step 3: after successful flush, we can drop locally-acked ops
  dropAckedOps();

  // Step 4: get fresh queue status
  const status = await callQueueStatus();
  return {
    ok: true,
    state: status.queueLength && status.queueLength > 0 ? "queued" : "flushed",
    queueLength: status.queueLength,
    lastFlushedAt: status.lastFlushedAt,
    newVersion: flushRes.newVersion,
  };
}

// ---- Optional auto-flush wiring (not exported) -----------------------------

let started = false;

/**
 * Call this once from your app bootstrap if you want:
 * - flush every 5 minutes
 * - flush on page hide / before unload (best-effort)
 */
export function __startAutoFlush(intervalMs = 5 * 60 * 1000) {
  if (started) return;
  started = true;

  // periodic
  try {
    setInterval(() => {
      flushPendingCommits().catch(() => {});
    }, intervalMs);
  } catch {}

  // on tab hide (more reliable than beforeunload)
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushPendingCommits({ keepalive: true }).catch(() => {});
      }
    });
  } catch {}

  // before unload (best effort)
  try {
    window.addEventListener("beforeunload", () => {
      // keepalive only works for simple requests; still better than nothing
      flushPendingCommits({ keepalive: true }).catch(() => {});
    });
  } catch {}
}

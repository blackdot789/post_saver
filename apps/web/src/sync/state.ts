// The sync engine's decisions (CLAUDE.md §6.5), kept apart from Firestore so they can be
// unit-tested. engine.ts applies them.

const MINUTE = 60_000;
const DAY = 24 * 3600 * 1000;

/** A device away longer than this does a full resync; tombstones live 60 days, so no delete is missed. */
export const FULL_RESYNC_AFTER_MS = 45 * DAY;
/** The delta query starts a little before the watermark, to cover commit-time skew. */
export const WATERMARK_SLACK_MS = 5 * MINUTE;
/** Trashed saves become tombstones after this long, tombstones are hard-deleted after that. */
export const TRASH_DAYS = 30;
export const TOMBSTONE_DAYS = 60;
/** Online but no answer from the server for this long: shown as offline. */
export const UNREACHABLE_AFTER_MS = 15_000;

/** What a device remembers between visits (localStorage, per account). */
export interface SyncRecord {
  /** The highest server `updatedAt` (ms) seen in a snapshot that was in sync with the server. */
  watermarkMs: number;
  /** When that snapshot arrived (ms). */
  lastSyncMs: number;
  /** `users/{uid}.syncEpoch` the watermark belongs to; a new epoch forces a full resync. */
  epoch: number;
}

export interface SyncPlan {
  mode: "full" | "delta";
  /** Listen to saves with `updatedAt > sinceMs`. */
  sinceMs: number;
}

/**
 * Delta sync from the watermark when the device cache is intact and recent; otherwise a full
 * resync (first visit, wiped cache, new epoch, or too long away).
 */
export function planSync(record: SyncRecord | null, cacheIntact: boolean, epoch: number, nowMs: number): SyncPlan {
  if (!record || !cacheIntact || record.epoch !== epoch || nowMs - record.lastSyncMs > FULL_RESYNC_AFTER_MS) {
    return { mode: "full", sinceMs: 0 };
  }
  return { mode: "delta", sinceMs: Math.max(0, record.watermarkMs - WATERMARK_SLACK_MS) };
}

/**
 * The record after a snapshot in sync with the server. Only server-confirmed documents count:
 * a pending local write has no server time yet. The watermark never moves backwards.
 */
export function advanceWatermark(record: SyncRecord | null, serverUpdatedAtMs: readonly number[], epoch: number, nowMs: number): SyncRecord {
  const highest = Math.max(record?.epoch === epoch ? record.watermarkMs : 0, ...serverUpdatedAtMs);
  return { watermarkMs: highest, lastSyncMs: nowMs, epoch };
}

export type SyncStatus = "syncing" | "synced" | "offline" | "paused";

export interface StatusInput {
  online: boolean;
  /** The daily quota is used up (a resource-exhausted error). */
  quotaExceeded: boolean;
  /** The current listener has delivered a snapshot in sync with the server. */
  caughtUp: boolean;
  /** Online for longer than UNREACHABLE_AFTER_MS without catching up. */
  unreachable: boolean;
  /** Local changes the server hasn't confirmed. */
  pendingCount: number;
}

export function syncStatus({ online, quotaExceeded, caughtUp, unreachable, pendingCount }: StatusInput): SyncStatus {
  if (quotaExceeded) return "paused";
  if (!online || unreachable) return "offline";
  return caughtUp && pendingCount === 0 ? "synced" : "syncing";
}

/** Milliseconds until the next midnight in Los Angeles, when Firestore's daily quotas reset. */
export function untilPacificMidnightMs(nowMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + (nowMs % 1000);
  return DAY - elapsed;
}

/**
 * When to attach the listener again after it failed. Quota: at the next Pacific midnight (plus
 * a little margin). Anything else: 30 s, doubling to 15 min.
 */
export function retryDelayMs(code: string | undefined, attempt: number, nowMs: number): number {
  if (code === "resource-exhausted") return untilPacificMidnightMs(nowMs) + 2 * MINUTE;
  return Math.min(30_000 * 2 ** attempt, 15 * MINUTE);
}

export interface PurgeCandidate {
  id: string;
  deleted: boolean;
  status?: string;
  trashedAtMs?: number;
  updatedAtMs?: number;
}

export interface PurgeItem {
  id: string;
  /** tombstone: strip a save trashed over 30 days ago · delete: remove a tombstone over 60 days old. */
  action: "tombstone" | "delete";
}

/** The delete timeline, applied when the library opens: trash → tombstone → gone. */
export function purgePlan(rows: readonly PurgeCandidate[], nowMs: number): PurgeItem[] {
  const out: PurgeItem[] = [];
  for (const row of rows) {
    // A day of margin over the rules' 60 days, so a device clock slightly ahead isn't refused.
    if (row.deleted && row.updatedAtMs !== undefined && nowMs - row.updatedAtMs > (TOMBSTONE_DAYS + 1) * DAY) {
      out.push({ id: row.id, action: "delete" });
    } else if (!row.deleted && row.status === "trashed" && row.trashedAtMs !== undefined && nowMs - row.trashedAtMs > TRASH_DAYS * DAY) {
      out.push({ id: row.id, action: "tombstone" });
    }
  }
  return out;
}

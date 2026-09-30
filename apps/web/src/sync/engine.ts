import { Timestamp, getDocFromCache, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { errorCode, savesOf, userRef } from "../data/firestore.ts";
import { readLocal, writeLocal } from "../lib/storage.ts";
import { advanceWatermark, planSync, retryDelayMs, type SyncPlan, type SyncRecord } from "./state.ts";

// The sync engine (CLAUDE.md §6.5): one delta listener per account, `saves where updatedAt >
// watermark`, so a visit only reads the documents that changed since the last one. The
// watermark is the highest server time seen in a snapshot that was in sync with the server,
// never the device clock. The library itself renders from the device cache (library.ts).

export interface EngineReport {
  mode: SyncPlan["mode"];
  /** The listener has delivered a snapshot in sync with the server since it was attached. */
  caughtUp: boolean;
  /** The last error's code, while waiting to try again. */
  error?: string;
  /** When the next attempt is due (ms since epoch), while waiting. */
  retryAtMs?: number;
}

const RECORD_KEY = "ps:sync:";

export function loadSyncRecord(uid: string): SyncRecord | null {
  try {
    const raw = readLocal(RECORD_KEY + uid);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const { watermarkMs, lastSyncMs, epoch } = parsed as Record<string, unknown>;
    if (typeof watermarkMs !== "number" || typeof lastSyncMs !== "number" || typeof epoch !== "number") return null;
    return { watermarkMs, lastSyncMs, epoch };
  } catch {
    return null;
  }
}

export function saveSyncRecord(uid: string, record: SyncRecord | null): void {
  writeLocal(RECORD_KEY + uid, record ? JSON.stringify(record) : "");
}

const toMillis = (value: unknown): number | undefined =>
  value && typeof (value as { toMillis?: unknown }).toMillis === "function" ? (value as { toMillis(): number }).toMillis() : undefined;

/** Starts syncing one account's library. Returns the stop function. */
export function startSync(uid: string, report: (state: EngineReport) => void): () => void {
  let stopped = false;
  let generation = 0;
  let attempt = 0;
  let record = loadSyncRecord(uid);
  let epoch = record?.epoch ?? 0;
  let unsubscribe: Unsubscribe | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  async function attach(): Promise<void> {
    if (stopped) return;
    const mine = ++generation;
    unsubscribe?.();
    unsubscribe = undefined;
    clearTimeout(retry);
    retry = undefined;

    // The profile document doubles as the cache sentinel: a cache that still holds it (or
    // remembers it as missing) wasn't wiped. Unknown means the cache is gone or in memory only.
    const cacheIntact = await getDocFromCache(userRef(uid)).then(
      () => true,
      () => false,
    );
    if (stopped || mine !== generation) return;
    const plan = planSync(record, cacheIntact, epoch, Date.now());
    if (plan.mode === "full") record = null;
    report({ mode: plan.mode, caughtUp: false });

    const changed = query(savesOf(uid), where("updatedAt", ">", Timestamp.fromMillis(plan.sinceMs)));
    unsubscribe = onSnapshot(
      changed,
      { includeMetadataChanges: true },
      (snap) => {
        if (mine !== generation || snap.metadata.fromCache) return;
        attempt = 0;
        const serverTimes = snap.docs.flatMap((d) => {
          const ms = d.metadata.hasPendingWrites ? undefined : toMillis(d.get("updatedAt"));
          return ms === undefined ? [] : [ms];
        });
        record = advanceWatermark(record, serverTimes, epoch, Date.now());
        saveSyncRecord(uid, record);
        report({ mode: plan.mode, caughtUp: true });
      },
      (error) => {
        if (mine !== generation) return;
        const code = errorCode(error);
        const delay = retryDelayMs(code, attempt++, Date.now());
        report({ mode: plan.mode, caughtUp: false, error: code ?? "unknown", retryAtMs: Date.now() + delay });
        retry = setTimeout(() => void attach(), delay);
      },
    );
  }

  // users/{uid}.syncEpoch: bumped by an admin to make every device resync from scratch.
  const unsubscribeUser = onSnapshot(
    userRef(uid),
    (snap) => {
      if (snap.metadata.fromCache) return;
      const serverEpoch = Number(snap.get("syncEpoch") ?? 0) || 0;
      if (serverEpoch !== epoch) {
        epoch = serverEpoch;
        record = null;
        void attach();
      }
    },
    () => undefined,
  );

  // Back online: don't wait out a retry delay.
  const onOnline = () => {
    if (retry) void attach();
  };
  window.addEventListener("online", onOnline);
  void attach();

  return () => {
    stopped = true;
    generation++;
    unsubscribe?.();
    unsubscribeUser();
    clearTimeout(retry);
    window.removeEventListener("online", onOnline);
  };
}

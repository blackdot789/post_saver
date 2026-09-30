import { useEffect, useRef, useState } from "react";
import { deleteSave, hardDeleteSave } from "../data/edits.ts";
import { readLocal, writeLocal } from "../lib/storage.ts";
import { useOnline } from "../lib/useOnline.ts";
import { startSync, type EngineReport } from "./engine.ts";
import { watchLibrary, type LibrarySnapshot } from "./library.ts";
import { UNREACHABLE_AFTER_MS, purgePlan, syncStatus, type SyncStatus } from "./state.ts";

export interface Library extends LibrarySnapshot {
  /** The device cache has answered at least once. */
  loaded: boolean;
  status: SyncStatus;
  /** full: everything is being fetched again · delta: only what changed since the last visit. */
  mode: "full" | "delta";
  /** Set while the daily quota is used up: when syncing resumes. */
  pausedUntil?: Date;
  /** Something other than the network stopped the sync (e.g. permission-denied), for support. */
  problem?: string;
}

const EMPTY: LibrarySnapshot = { saves: [], tombstones: [], pendingCount: 0 };
const PURGED_KEY = "ps:purged:";
/** Lets the device cache catch up with the server snapshot before the purge looks at it. */
const PURGE_AFTER_MS = 3000;

/** The delete timeline (trash → tombstone → gone), once a day per device, after a full sync. */
function purge(uid: string, snapshot: LibrarySnapshot): void {
  const today = new Date().toISOString().slice(0, 10);
  if (readLocal(PURGED_KEY + uid) === today) return;
  writeLocal(PURGED_KEY + uid, today);
  const rows = [
    ...snapshot.saves.map((s) => ({ id: s.id, deleted: false, status: s.status, trashedAtMs: s.trashedAt?.getTime() })),
    ...snapshot.tombstones.map((t) => ({ id: t.id, deleted: true, updatedAtMs: t.updatedAt?.getTime() })),
  ];
  for (const item of purgePlan(rows, Date.now())) {
    (item.action === "delete" ? hardDeleteSave(uid, item.id) : deleteSave(uid, item.id)).catch(() => undefined);
  }
}

/** The account's library from the device cache, kept in sync with the server. */
export function useLibrary(uid: string): Library {
  const online = useOnline();
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [engine, setEngine] = useState<EngineReport>({ mode: "delta", caughtUp: false });
  const [unreachable, setUnreachable] = useState(false);
  const latest = useRef<LibrarySnapshot | null>(null);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  useEffect(() => watchLibrary(uid, setSnapshot, () => setSnapshot(EMPTY)), [uid]);
  useEffect(() => startSync(uid, setEngine), [uid]);

  useEffect(() => {
    if (!engine.caughtUp) return;
    const timer = setTimeout(() => {
      if (latest.current) purge(uid, latest.current);
    }, PURGE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [engine.caughtUp, uid]);

  // Online, but nothing from the server for a while: a captive portal, a firewall, an outage.
  useEffect(() => {
    if (engine.caughtUp || !online) {
      setUnreachable(false);
      return;
    }
    const timer = setTimeout(() => setUnreachable(true), UNREACHABLE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [engine.caughtUp, online]);

  const quotaExceeded = engine.error === "resource-exhausted";
  const status = syncStatus({ online, quotaExceeded, caughtUp: engine.caughtUp, unreachable, pendingCount: snapshot?.pendingCount ?? 0 });
  const problem = engine.error && !quotaExceeded && engine.error !== "unavailable" ? engine.error : undefined;
  return {
    ...(snapshot ?? EMPTY),
    loaded: snapshot !== null,
    status,
    mode: engine.mode,
    ...(quotaExceeded && engine.retryAtMs ? { pausedUntil: new Date(engine.retryAtMs) } : {}),
    ...(problem ? { problem } : {}),
  };
}

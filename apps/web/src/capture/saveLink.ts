import {
  deleteField,
  getDocFromCache,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { cleanText, moveToTop, newSave, newText, parse, planSave, restoreFromTrash, saveId, textId, type SaveSource } from "@postsaver/core";
import { getAuth } from "../auth/session.ts";
import { errorCode, requestPersistentStorage, saveRef } from "../data/firestore.ts";
import { itemKey, type Item } from "./item.ts";
import { listPending, removePending } from "./pending.ts";

// saveItem(): the one way every capture path saves a post or a text (CLAUDE.md §6.1). The
// document id comes from the link (or the text), so saving the same thing twice, from any
// device, never makes a duplicate. The write is never awaited: the device cache applies it at
// once, and Firestore sends it when it can, even after the page is closed.

export type SaveOutcome = "created" | "restored" | "exists";

export interface Saved {
  outcome: SaveOutcome;
  /** When the post was first saved; set for "exists". */
  savedAt?: Date;
}

export interface SaveResult extends Saved {
  id: string;
  /**
   * Settles once the server has the save. Resolves with the final result, which can differ
   * from the first one (a post this device took for new may already be saved from another
   * device). Rejects when the save was refused. Stays pending while offline.
   */
  synced: Promise<Saved>;
}

/**
 * How long to wait for the server's copy before going with the device's. The save must show
 * as done in under 1.5 s on a phone over 4G.
 */
const SERVER_WAIT_MS = 1200;

// Refusals that mean "the server's copy isn't what this device thought", so look again.
const RECHECK_CODES = new Set(["permission-denied", "not-found", "failed-precondition", "already-exists"]);

interface Lookup {
  /** The stored document, null when there is none, undefined when unknown (offline, not cached). */
  stored: DocumentData | null | undefined;
  fromServer: boolean;
}

const sleep = (ms: number) => new Promise<undefined>((resolve) => setTimeout(resolve, ms, undefined));

/** The server's copy when it answers quickly, otherwise the device's. */
async function lookup(ref: DocumentReference): Promise<Lookup> {
  if (navigator.onLine) {
    const server = getDocFromServer(ref);
    server.catch(() => undefined);
    const snap = await Promise.race([server, sleep(SERVER_WAIT_MS)]).catch(() => undefined);
    if (snap) return { stored: snap.exists() ? snap.data() : null, fromServer: true };
  }
  try {
    const snap = await getDocFromCache(ref);
    return { stored: snap.exists() ? snap.data() : null, fromServer: false };
  } catch {
    return { stored: undefined, fromServer: false };
  }
}

function toDate(value: unknown): Date | undefined {
  return value && typeof (value as { toDate?: unknown }).toDate === "function" ? (value as { toDate(): Date }).toDate() : undefined;
}

/** Applies the plan for what's stored. `done` settles when the server has the write. */
function write(
  ref: DocumentReference,
  item: Item,
  source: SaveSource,
  stored: DocumentData | null | undefined,
): { saved: Saved; done: Promise<void> } {
  const now = serverTimestamp();
  switch (planSave(stored)) {
    case "create":
      return { saved: { outcome: "created" }, done: setDoc(ref, item.link ? newSave(item.link, { source, now }) : newText(item.text, { source, now })) };
    case "restore":
      return {
        saved: { outcome: "restored" },
        done: updateDoc(ref, { ...restoreFromTrash(now, deleteField()), ...moveToTop(now) }),
      };
    case "exists":
      return { saved: { outcome: "exists", savedAt: toDate(stored?.savedAt) }, done: Promise.resolve() };
  }
}

async function run(uid: string, item: Item, source: SaveSource): Promise<SaveResult> {
  const id = item.link ? await saveId(item.link) : await textId(item.text);
  const ref = saveRef(uid, id);
  const seen = await lookup(ref);
  const first = write(ref, item, source, seen.stored);
  // Firestore runs local work in order, so once this read returns, the write is stored on the
  // device (in IndexedDB) and survives the page closing.
  if (first.saved.outcome !== "exists") await getDocFromCache(ref).catch(() => undefined);
  if (first.saved.outcome === "created") requestPersistentStorage();

  const synced = (async (): Promise<Saved> => {
    try {
      await first.done;
      // "Already saved" from this device's cache while the server was slow: the server's copy
      // may have changed since (deleted or trashed on another device), so check it.
      if (first.saved.outcome !== "exists" || seen.fromServer || !navigator.onLine) return first.saved;
      try {
        const snap = await getDocFromServer(ref);
        if (planSave(snap.exists() ? snap.data() : null) === "exists") return first.saved;
      } catch {
        return first.saved;
      }
    } catch (error) {
      if (!RECHECK_CODES.has(errorCode(error) ?? "")) throw error;
      // Refused because the server's copy differs (e.g. another device saved it first). A
      // stale sign-in token (verified since it was issued) is refused the same way; refresh it.
      await getAuth().currentUser?.getIdToken(true);
    }
    const snap = await getDocFromServer(ref);
    const second = write(ref, item, source, snap.exists() ? snap.data() : null);
    await second.done;
    return second.saved;
  })();
  synced.catch(() => undefined);
  return { id, ...first.saved, synced };
}

// One save per item at a time, so a double tap (or React's double effects in development)
// can't race itself.
const inflight = new Map<string, Promise<SaveResult>>();

export function saveItem(uid: string, item: Item, source: SaveSource): Promise<SaveResult> {
  const key = `${uid} ${itemKey(item)}`;
  let result = inflight.get(key);
  if (!result) {
    result = run(uid, item, source);
    inflight.set(key, result);
    result
      .then((r) => r.synced)
      .catch(() => undefined)
      .finally(() => inflight.delete(key));
  }
  return result;
}

/** What a waiting entry (pending.ts) saves; null when it no longer holds anything usable. */
export function pendingItem(entry: { url: string; text?: string }): Item | null {
  if (entry.text !== undefined) {
    const text = cleanText(entry.text);
    return text ? { text } : null;
  }
  const link = parse(entry.url);
  return link ? { link } : null;
}

/**
 * Saves the links and texts that were shared while signed out (see pending.ts) and returns how
 * many. Each leaves the waiting list once its write is in the device cache, from where
 * Firestore sends it.
 */
export async function savePending(uid: string): Promise<number> {
  let saved = 0;
  for (const entry of await listPending()) {
    const item = pendingItem(entry);
    if (item) {
      await saveItem(uid, item, entry.source);
      saved++;
    }
    await removePending(entry.url);
  }
  return saved;
}

export interface LiveSave {
  tags: string[];
  note: string;
  /** Changes on this device the server hasn't confirmed yet. */
  pending: boolean;
}

/** Follows one save (tags, note, sync state). Returns the unsubscribe function. */
export function watchSave(uid: string, id: string, onChange: (save: LiveSave | null) => void): () => void {
  return onSnapshot(
    saveRef(uid, id),
    { includeMetadataChanges: true },
    (snap) => {
      const data = snap.data();
      if (!data || data.deleted) return onChange(null);
      onChange({
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        note: typeof data.note === "string" ? data.note : "",
        pending: snap.metadata.hasPendingWrites,
      });
    },
    () => onChange(null),
  );
}

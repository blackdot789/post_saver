import {
  CACHE_SIZE_UNLIMITED,
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp, useEmulators } from "../lib/firebase.ts";
import { readLocal, writeLocal } from "../lib/storage.ts";

let db: Firestore | undefined;

/**
 * The shared Firestore instance, with the device cache in IndexedDB (CLAUDE.md §6.5):
 * - Writes made offline wait there and are sent when the device reconnects, even after the
 *   page is closed and opened again.
 * - The cache is unlimited, because a document evicted from it would never come back through
 *   the delta sync.
 * - Several tabs share one cache. Where IndexedDB is blocked, the SDK falls back to memory.
 */
export function getDb(): Firestore {
  if (!db) {
    db = initializeFirestore(firebaseApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    });
    if (useEmulators) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}

export function savesOf(uid: string): CollectionReference {
  return collection(getDb(), "users", uid, "saves");
}

export function saveRef(uid: string, id: string): DocumentReference {
  return doc(getDb(), "users", uid, "saves", id);
}

export function userRef(uid: string): DocumentReference {
  return doc(getDb(), "users", uid);
}

/** Firestore's error code, e.g. "permission-denied" or "unavailable". */
export function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Wipes the device copy of the library (on sign-out, so a shared computer keeps nothing).
 * Fails quietly when another tab still uses the cache; that tab signs out too, and the cache
 * is cleared the next time.
 */
export async function clearLocalData(): Promise<void> {
  if (!db) return;
  const instance = db;
  db = undefined;
  try {
    await terminate(instance);
    await clearIndexedDbPersistence(instance);
  } catch {
    // Another tab holds the cache, or persistence was never on.
  }
}

const PERSIST_KEY = "ps:storage-persist";

/**
 * Asks the browser not to evict this site's storage (the offline queue and the library copy).
 * Once per device, after the first save. Chrome and Safari decide silently; Firefox asks once.
 */
export function requestPersistentStorage(): void {
  if (readLocal(PERSIST_KEY) || !navigator.storage?.persist) return;
  writeLocal(PERSIST_KEY, "1");
  navigator.storage.persist().catch(() => undefined);
}

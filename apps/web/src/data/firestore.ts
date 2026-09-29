import {
  CACHE_SIZE_UNLIMITED,
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp, useEmulators } from "../lib/firebase.ts";

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

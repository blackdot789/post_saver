import type { SaveSource } from "@postsaver/core";

// Links and texts shared while signed out or before the email is verified. The database only accepts
// writes from verified accounts, so these wait on this device (in IndexedDB, which a service
// worker can read too) and are saved as soon as someone signs in (CLAUDE.md §6.1).

export interface PendingSave {
  /** The link as shared; also the key, so sharing it twice keeps one entry. For a text: `text:` + its id. */
  url: string;
  /** Set when what waits is a text, not a link. */
  text?: string;
  source: SaveSource;
  /** When it was shared (ms since epoch). */
  at: number;
}

const DB_NAME = "ps-capture";
const STORE = "pending";
const MAX_ITEMS = 100;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "url" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Oldest first. */
export async function listPending(): Promise<PendingSave[]> {
  const items = await run("readonly", (store) => store.getAll() as IDBRequest<PendingSave[]>);
  return items.sort((a, b) => a.at - b.at);
}

/** Keeps a link to save later. Throws when this browser can't store it (e.g. storage blocked). */
export async function addPending(item: PendingSave): Promise<void> {
  const items = await listPending();
  const oldest = items[0];
  if (oldest && items.length >= MAX_ITEMS && !items.some((i) => i.url === item.url)) await removePending(oldest.url);
  await run("readwrite", (store) => store.put(item));
}

export async function removePending(url: string): Promise<void> {
  await run("readwrite", (store) => store.delete(url));
}

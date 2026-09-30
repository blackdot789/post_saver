import type { Addition, Prepared } from "./plan.ts";
import type { ImportType } from "./types.ts";

// An import in progress, kept on this device (IndexedDB), because the file is gone once the
// dialog closes and a big import runs over several days (CLAUDE.md §6.11). The account's
// `imports/{id}` document only says how far it is.

export interface ImportJob {
  /** Also the id of the account's imports/{id} document. */
  id: string;
  uid: string;
  type: ImportType;
  createdAt: number;
  add: Prepared[];
  update: Addition[];
  /** Saves to move to the Trash: unsaved on Instagram, when the person chose to remove those. */
  trash: string[];
  /** How many entries of add + update + trash have been dealt with. */
  cursor: number;
  /** Posts added so far, and saves that gained tags or collections or went to the Trash. */
  added: number;
  changed: number;
  /** Collections found or created so far: lower-case name → id. */
  collectionIds: Record<string, string>;
  /** Paused by the person. */
  paused: boolean;
}

export const jobTotal = (job: ImportJob): number => job.add.length + job.update.length + job.trash.length;

const DB_NAME = "ps-import";
const STORE = "jobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
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

/** The account's import in progress on this device, if any (the oldest, should there be two). */
export async function loadJob(uid: string): Promise<ImportJob | null> {
  const jobs = await run("readonly", (store) => store.getAll() as IDBRequest<ImportJob[]>);
  return jobs.filter((j) => j.uid === uid).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
}

export async function storeJob(job: ImportJob): Promise<void> {
  await run("readwrite", (store) => store.put(job));
}

export async function removeJob(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}

/** Forgets every import kept on this device (when the account is deleted). */
export function forgetJobs(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

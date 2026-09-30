import { arrayRemove, arrayUnion, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentReference } from "firebase/firestore";
import { LIMITS, tombstone } from "@postsaver/core";
import { getDb, saveRef } from "./firestore.ts";

// users/{uid}/collections/{cid} (CLAUDE.md §6.4): a name, an optional emoji and colour, and a
// sort order. A save lists the collections it's in (collectionIds, at most 50).

export interface Collection {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  order: number;
  pending: boolean;
}

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A random id the rules accept (`[A-Za-z0-9]{1,40}`). */
export function newCollectionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

function ref(uid: string, id: string): DocumentReference {
  return doc(getDb(), "users", uid, "collections", id);
}

/** The account's collections, live, in order. */
export function watchCollections(uid: string, onChange: (collections: Collection[]) => void): () => void {
  return onSnapshot(
    collection(getDb(), "users", uid, "collections"),
    { includeMetadataChanges: true },
    (snap) => {
      const list: Collection[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.deleted === true || typeof data.name !== "string") continue;
        list.push({
          id: d.id,
          name: data.name,
          ...(typeof data.emoji === "string" && data.emoji ? { emoji: data.emoji } : {}),
          ...(typeof data.color === "string" && data.color ? { color: data.color } : {}),
          order: typeof data.order === "number" ? data.order : 0,
          pending: d.metadata.hasPendingWrites,
        });
      }
      list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      onChange(list);
    },
    () => onChange([]),
  );
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, LIMITS.collectionName);
}

/** Creates a collection and returns its id. */
export function createCollection(uid: string, name: string, order: number): { id: string; done: Promise<void> } {
  const id = newCollectionId();
  const now = serverTimestamp();
  const done = setDoc(ref(uid, id), { name: cleanName(name), order, createdAt: now, updatedAt: now, deleted: false });
  return { id, done };
}

export function renameCollection(uid: string, id: string, name: string): Promise<void> {
  return updateDoc(ref(uid, id), { name: cleanName(name), updatedAt: serverTimestamp() });
}

/** Deletes a collection (a tombstone). Saves keep the id in collectionIds; it's simply ignored. */
export function deleteCollection(uid: string, id: string): Promise<void> {
  return setDoc(ref(uid, id), tombstone(serverTimestamp()));
}

export function addToCollection(uid: string, saveId: string, collectionId: string): Promise<void> {
  return updateDoc(saveRef(uid, saveId), { collectionIds: arrayUnion(collectionId), updatedAt: serverTimestamp() });
}

export function removeFromCollection(uid: string, saveId: string, collectionId: string): Promise<void> {
  return updateDoc(saveRef(uid, saveId), { collectionIds: arrayRemove(collectionId), updatedAt: serverTimestamp() });
}

import { arrayRemove, arrayUnion, deleteDoc, deleteField, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { LIMITS, moveToTop, normalizeTags, restoreFromTrash, tombstone } from "@postsaver/core";
import { saveRef } from "./firestore.ts";

// Edits to a save. Each goes to the device cache at once and syncs like the save itself; the
// promise settles only when the server confirms (or refuses). Field-level updates, and
// arrayUnion/arrayRemove for lists, so two devices editing the same save don't overwrite each
// other (CLAUDE.md §6.5).

export function moveSaveToTop(uid: string, id: string): Promise<void> {
  return updateDoc(saveRef(uid, id), moveToTop(serverTimestamp()));
}

export function addTags(uid: string, id: string, tags: readonly string[]): Promise<void> {
  const clean = normalizeTags(tags);
  if (clean.length === 0) return Promise.resolve();
  return updateDoc(saveRef(uid, id), { tags: arrayUnion(...clean), updatedAt: serverTimestamp() });
}

export function removeTag(uid: string, id: string, tag: string): Promise<void> {
  return updateDoc(saveRef(uid, id), { tags: arrayRemove(tag), updatedAt: serverTimestamp() });
}

export function setNote(uid: string, id: string, note: string): Promise<void> {
  const text = note.trim().slice(0, LIMITS.note);
  return updateDoc(saveRef(uid, id), { note: text || deleteField(), updatedAt: serverTimestamp() });
}

export function setFavorite(uid: string, id: string, favorite: boolean): Promise<void> {
  return updateDoc(saveRef(uid, id), { favorite, updatedAt: serverTimestamp() });
}

/** Step 1 of the delete timeline: the save can be restored for 30 days. */
export function trashSave(uid: string, id: string): Promise<void> {
  return updateDoc(saveRef(uid, id), { status: "trashed", trashedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function restoreSave(uid: string, id: string): Promise<void> {
  return updateDoc(saveRef(uid, id), restoreFromTrash(serverTimestamp(), deleteField()));
}

/** Step 2: only a tombstone remains, so every device learns about the delete. */
export function deleteSave(uid: string, id: string): Promise<void> {
  return setDoc(saveRef(uid, id), tombstone(serverTimestamp()));
}

/** Step 3: a tombstone older than 60 days is removed for good (the rules refuse it earlier). */
export function hardDeleteSave(uid: string, id: string): Promise<void> {
  return deleteDoc(saveRef(uid, id));
}

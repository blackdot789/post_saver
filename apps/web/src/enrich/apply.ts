import { deleteField, getDocFromCache, serverTimestamp, Timestamp, updateDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { newSave, parse, planSave, restoreFromTrash, saveId, tombstone, type LinkMeta } from "@postsaver/core";
import { getDb, saveRef } from "../data/firestore.ts";
import type { LibrarySave } from "../sync/library.ts";
import { mergeExtras, metaChanges, type Extras } from "./queue.ts";

// What a finished lookup writes (CLAUDE.md §6.2, §6.3). Like every edit, the writes go to the
// device cache at once; the returned promises settle when the server confirms or refuses.

/** Stores a title, author and thumbnail, and marks the save as not waiting any more. */
export function applyMeta(uid: string, save: LibrarySave, meta: LinkMeta): Promise<void> {
  return updateDoc(saveRef(uid, save.id), { ...metaChanges(save, meta), needsMeta: false, updatedAt: serverTimestamp() });
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function extrasOf(data: DocumentData): Extras {
  return {
    tags: strings(data.tags),
    collectionIds: strings(data.collectionIds),
    favorite: data.favorite === true,
    ...(typeof data.note === "string" && data.note ? { note: data.note } : {}),
    ...(typeof data.category === "string" && data.category ? { category: data.category } : {}),
  };
}

/**
 * A short link turned out to lead to `finalUrl`. The link and identity of a save never change,
 * so the post gets its own save (or, if it's saved already, gains the short link's tags,
 * collections, favorite and note), and the short link's save becomes a tombstone. Both writes
 * go together.
 *
 * Returns null when `finalUrl` is no better than the short link; otherwise `done`, which
 * settles with the server's verdict (wrapped, so awaiting this function doesn't wait for it).
 */
export async function applyResolved(uid: string, save: LibrarySave, finalUrl: string): Promise<{ done: Promise<void> } | null> {
  const link = parse(finalUrl);
  if (!link || link.needsResolve) return null;
  const id = await saveId(link);
  const now = serverTimestamp();
  const oldRef = saveRef(uid, save.id);
  if (id === save.id) return { done: updateDoc(oldRef, { needsResolve: false, updatedAt: now }) };

  const newRef = saveRef(uid, id);
  // The library is in the device cache; a post that isn't there isn't saved (as far as this
  // device knows: if another device saved it meanwhile, the server refuses and this is retried).
  const existing = await getDocFromCache(newRef).then(
    (snap) => (snap.exists() ? snap.data() : null),
    () => null,
  );
  const mine: Extras = {
    tags: save.tags,
    collectionIds: save.collectionIds,
    favorite: save.favorite,
    ...(save.note ? { note: save.note } : {}),
    ...(save.category ? { category: save.category } : {}),
  };

  const batch = writeBatch(getDb());
  if (planSave(existing) === "create" || !existing) {
    batch.set(newRef, {
      ...newSave(link, { source: save.source, now, savedAt: save.savedAt ? Timestamp.fromDate(save.savedAt) : now, tags: save.tags, note: save.note, category: save.category }),
      // The link as it was shared stays on record.
      originalUrl: save.originalUrl,
      collectionIds: save.collectionIds,
      favorite: save.favorite,
    });
  } else {
    const gains = mergeExtras(extrasOf(existing), mine);
    const restore = existing.status === "trashed" ? restoreFromTrash(now, deleteField()) : null;
    if (gains || restore) batch.update(newRef, { ...gains, ...restore, updatedAt: now });
  }
  batch.set(oldRef, tombstone(now));
  return { done: batch.commit() };
}

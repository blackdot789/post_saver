import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentReference } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { BUILT_IN_CATEGORIES, TEXT_PLATFORM, cleanCategoryName, newCategory, tombstone, type CategoryInfo, type SavePlatform } from "@postsaver/core";
import { newCollectionId } from "./collections.ts";
import { getDb } from "./firestore.ts";

// A category says what kind of thing a save is (CLAUDE.md §6.1 "As built: categories"): one of
// the ready-made ones (BUILT_IN_CATEGORIES in core; they have no document), or one the owner
// made: users/{uid}/categories/{cid}, with a name, an emoji as its symbol and a sort order.
// A save names its category by id (`category`), one at most.

export interface Category extends CategoryInfo {
  /** Made by the owner, so it can be renamed and deleted; false for the ready-made ones. */
  own: boolean;
}

/** Every category by id, the ready-made ones first, then the owner's in their order. */
export type CategoryIndex = ReadonlyMap<string, Category>;

/** The symbols offered for a category of one's own. */
export const CATEGORY_SYMBOLS: readonly string[] = [
  "⭐", "❤️", "💡", "📌", "🔖", "📚", "🎓", "💼", "💰", "🛒",
  "🍳", "☕", "🏠", "✈️", "🗺️", "🏋️", "🎵", "🎬", "🎮", "🎨",
  "📷", "🧪", "🧠", "🛠️", "💻", "📱", "🔗", "🔑", "📅", "✅",
  "🎯", "🚀", "🌱", "🐾", "👗", "🎁", "⚽", "🚗", "😂", "🙏",
];

/** The symbol of a category that comes without one (from an import). */
export const DEFAULT_SYMBOL = "🔖";

/** Categories of one's own an account may have. */
export const MAX_OWN_CATEGORIES = 50;

const BUILT_IN: readonly Category[] = BUILT_IN_CATEGORIES.map((c) => ({ ...c, own: false }));

export function indexCategories(own: readonly Category[]): CategoryIndex {
  return new Map([...BUILT_IN, ...own].map((c) => [c.id, c]));
}

/** The ready-made categories alone: what's known before the owner's have been read. */
export const BUILT_IN_INDEX: CategoryIndex = indexCategories([]);

/**
 * "Text" and "Web" say only that a save is nothing more particular: a text or page that has a
 * category goes by its category instead. A post from an app is always that app's as well.
 */
export const isGenericPlatform = (platform: SavePlatform): boolean => platform === TEXT_PLATFORM || platform === "web";

/** The category a save is filed under: none when it has none, or its category has been deleted. */
export function categoryOf(save: { category?: string }, categories: CategoryIndex): Category | undefined {
  return save.category ? categories.get(save.category) : undefined;
}

/** The category with this name, whatever its capitals. */
export function findCategory(name: string, categories: CategoryIndex): Category | undefined {
  const key = cleanCategoryName(name).toLowerCase();
  for (const category of categories.values()) if (category.name.toLowerCase() === key) return category;
  return undefined;
}

function ref(uid: string, id: string): DocumentReference {
  return doc(getDb(), "users", uid, "categories", id);
}

/**
 * The owner's categories, live, in order. With `source: "cache"` only this device's copy is
 * read (no server reads): the capture pages use that, and the library keeps the copy current.
 */
export function watchCategories(uid: string, onChange: (own: Category[]) => void, source: "default" | "cache" = "default"): () => void {
  return onSnapshot(
    collection(getDb(), "users", uid, "categories"),
    { includeMetadataChanges: true, source },
    (snap) => {
      const list: Array<Category & { order: number }> = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.deleted === true || typeof data.name !== "string" || !data.name) continue;
        list.push({
          id: d.id,
          name: data.name,
          symbol: typeof data.symbol === "string" && data.symbol ? data.symbol : DEFAULT_SYMBOL,
          own: true,
          order: typeof data.order === "number" ? data.order : 0,
        });
      }
      list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      onChange(list.map(({ order: _order, ...category }) => category));
    },
    () => onChange([]),
  );
}

/** Every category the account has: the ready-made ones at once, the owner's as soon as they're read. */
export function useCategories(uid: string, source: "default" | "cache" = "default"): CategoryIndex {
  const [own, setOwn] = useState<Category[]>([]);
  useEffect(() => watchCategories(uid, setOwn, source), [uid, source]);
  return useMemo(() => indexCategories(own), [own]);
}

/** Creates a category of the owner's own and returns its id. */
export function createCategory(uid: string, name: string, symbol: string, order: number): { id: string; done: Promise<void> } {
  const id = newCollectionId();
  return { id, done: setDoc(ref(uid, id), newCategory({ name, symbol, order, now: serverTimestamp() })) };
}

export function updateCategory(uid: string, id: string, change: { name: string; symbol: string }): Promise<void> {
  return updateDoc(ref(uid, id), { name: cleanCategoryName(change.name), symbol: change.symbol, updatedAt: serverTimestamp() });
}

/** Deletes a category (a tombstone). Saves keep its id; they're filed as if they had none. */
export function deleteCategory(uid: string, id: string): Promise<void> {
  return setDoc(ref(uid, id), tombstone(serverTimestamp()));
}

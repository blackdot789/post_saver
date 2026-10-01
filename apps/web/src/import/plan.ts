import { LIMITS, cleanText, normalizeTags, parse, saveId, textId, type ParsedLink } from "@postsaver/core";
import type { LibrarySave } from "../sync/library.ts";
import type { ImportItem, ImportType, ParsedFile } from "./types.ts";

// What an import will do (CLAUDE.md §6.1), worked out before anything is written: which links
// are new, which are in the library already, and, for a repeated Instagram import, which posts
// have since been unsaved on Instagram. Pure apart from hashing ids.

/** A link (or a saved text) ready to be written. */
export interface Prepared {
  id: string;
  /** The link as it is in the file; empty for a text. */
  url: string;
  /** The text to save, when the entry is one. */
  text?: string;
  savedAt?: number;
  tags: string[];
  note?: string;
  /** Collection names; the importer turns them into ids. */
  collections: string[];
  /** A title from the file, kept only for ordinary web pages. */
  title?: string;
  favorite?: boolean;
}

/** A save already in the library that the file adds tags or collections to. */
export interface Addition {
  id: string;
  tags: string[];
  collections: string[];
}

export interface ImportPlan {
  type: ImportType;
  /** New saves, newest first. */
  add: Prepared[];
  /** Saves that gain tags or collections from the file. */
  update: Addition[];
  /** Links in the file that are in the library already (including the ones in `update`). */
  already: number;
  /** Rows without a link, or with one that can't be stored. */
  invalid: number;
  /** The same post more than once in the file. */
  repeated: number;
  /**
   * Instagram only: posts from an earlier Instagram import that this file no longer lists,
   * because they were unsaved on Instagram.
   */
  missing: LibrarySave[];
  /** Every collection name the writes need. */
  collections: string[];
}

/** New collections one import may create; folders beyond that are left out. */
export const MAX_NEW_COLLECTIONS = 30;

const cleanName = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, LIMITS.collectionName);

function unique(values: readonly string[], max: number): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (value && !seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()].slice(0, max);
}

export async function planImport(
  parsed: ParsedFile,
  library: readonly LibrarySave[],
  /** Existing collections: id → name. */
  collectionNames: ReadonlyMap<string, string> = new Map(),
): Promise<ImportPlan> {
  const existing = new Map(library.map((s) => [s.id, s]));
  const byId = new Map<string, { link: ParsedLink | null; text: string | null; item: ImportItem }>();
  let invalid = parsed.skipped;
  let repeated = 0;

  for (const item of parsed.items) {
    const text = item.text !== undefined ? cleanText(item.text) : null;
    const link = item.text === undefined ? parse(item.url) : null;
    if (!link && !text) {
      invalid++;
      continue;
    }
    const id = link ? await saveId(link) : await textId(text ?? "");
    const before = byId.get(id);
    if (!before) {
      byId.set(id, { link, text, item: { ...item } });
      continue;
    }
    // The same post again (Instagram lists a post once per collection): combine what's known.
    repeated++;
    const merged = before.item;
    merged.tags = [...(merged.tags ?? []), ...(item.tags ?? [])];
    merged.collections = [...(merged.collections ?? []), ...(item.collections ?? [])];
    merged.savedAt ??= item.savedAt;
    merged.note ??= item.note;
    merged.title ??= item.title;
    merged.favorite ||= item.favorite;
  }

  const add: Prepared[] = [];
  const update: Addition[] = [];
  let already = 0;
  for (const [id, { link, text, item }] of byId) {
    const tags = normalizeTags(item.tags ?? []);
    const collections = unique((item.collections ?? []).map(cleanName), LIMITS.collectionIds);
    const saved = existing.get(id);
    if (saved) {
      already++;
      // A save in the Trash was put there on purpose: it's left alone.
      if (saved.status !== "active") continue;
      const has = new Set(saved.collectionIds.map((cid) => collectionNames.get(cid)?.toLowerCase()));
      const newTags = tags.filter((t) => !saved.tags.includes(t)).slice(0, Math.max(0, LIMITS.tags - saved.tags.length));
      const newCollections = collections.filter((c) => !has.has(c.toLowerCase())).slice(0, Math.max(0, LIMITS.collectionIds - saved.collectionIds.length));
      if (newTags.length || newCollections.length) update.push({ id, tags: newTags, collections: newCollections });
      continue;
    }
    const note = item.note?.trim().slice(0, LIMITS.note);
    const title = link?.platform === "web" ? item.title?.trim().slice(0, LIMITS.title) : undefined;
    add.push({
      id,
      url: item.url,
      ...(text ? { text } : {}),
      ...(item.savedAt ? { savedAt: item.savedAt } : {}),
      tags,
      ...(note ? { note } : {}),
      collections,
      ...(title ? { title } : {}),
      ...(item.favorite ? { favorite: true } : {}),
    });
  }
  // Newest first: if the daily limit splits the import, the recent saves arrive first.
  add.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

  // Collections that don't exist yet, up to the limit; names past it are dropped from the writes.
  const known = new Set([...collectionNames.values()].map((n) => n.toLowerCase()));
  const wanted = unique([...add, ...update].flatMap((p) => p.collections), Infinity);
  const fresh = wanted.filter((n) => !known.has(n.toLowerCase())).slice(0, MAX_NEW_COLLECTIONS);
  const allowed = new Set([...known, ...fresh.map((n) => n.toLowerCase())]);
  for (const p of [...add, ...update]) p.collections = p.collections.filter((c) => allowed.has(c.toLowerCase()));
  const collections = wanted.filter((n) => allowed.has(n.toLowerCase()));

  const missing =
    parsed.type === "instagram" && byId.size > 0
      ? library.filter((s) => s.platform === "instagram" && s.source === "import-instagram" && s.status === "active" && !byId.has(s.id))
      : [];

  return { type: parsed.type, add, update: update.filter((u) => u.tags.length || u.collections.length), already, invalid, repeated, missing, collections };
}

// ---------- the daily limit (CLAUDE.md §6.11) ----------

/** Posts one account may import per day when `config/app` doesn't say. */
export const DEFAULT_DAILY_CAP = 500;

/** The day Firestore's quotas count by: the date in Los Angeles. */
export function pacificDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export interface DayCount {
  day: string;
  count: number;
}

/** How many more writes an import may make today. */
export function leftToday(record: DayCount | null, cap: number, now: number): number {
  const used = record?.day === pacificDay(now) ? record.count : 0;
  return Math.max(0, Math.floor(cap) - used);
}

export function countWrites(record: DayCount | null, writes: number, now: number): DayCount {
  const day = pacificDay(now);
  return { day, count: (record?.day === day ? record.count : 0) + writes };
}

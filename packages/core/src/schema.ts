// Firestore document shapes (CLAUDE.md §6.4). firebase/firestore.rules enforces the same
// fields and limits; the rules tests build documents with these helpers so both stay in step.
import type { Kind, ParsedLink, Platform } from "./types.ts";
import { MAX_URL_LENGTH } from "./url.ts";

export const SCHEMA_VERSION = 1;

export const LIMITS = {
  url: MAX_URL_LENGTH,
  platformId: 300,
  author: 100,
  title: 500,
  note: 5000,
  tags: 30,
  tagLength: 40,
  collectionIds: 50,
  collectionName: 60,
  emoji: 16,
  displayName: 100,
  importTotal: 100_000,
  importError: 500,
} as const;

export const SAVE_STATUSES = ["active", "trashed"] as const;
export type SaveStatus = (typeof SAVE_STATUSES)[number];

export const EMBED_STATUSES = ["ok", "unavailable", "unknown"] as const;
export type EmbedStatus = (typeof EMBED_STATUSES)[number];

export const IMPORT_STATUSES = ["running", "paused", "done", "failed", "cancelled"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** Where a save came from. `import-*` and `sync-*` name the file type or platform. */
export type SaveSource =
  | "web"
  | "share-android"
  | "ios-shortcut"
  | "bookmarklet"
  | "paste"
  | "extension"
  | `import-${string}`
  | `sync-${string}`;

/** Thumbnails are stored only from hosts whose image URLs don't expire. */
export const STABLE_THUMB_PREFIX = "https://i.ytimg.com/";

/** `/users/{uid}/saves/{saveId}`. `T` is the timestamp type (Firestore Timestamp or a server-time sentinel). */
export interface SaveDoc<T> {
  url: string;
  originalUrl: string;
  platform: Platform;
  kind: Kind;
  platformId: string | null;
  author?: string;
  title?: string;
  thumb?: string;
  note?: string;
  tags: string[];
  collectionIds: string[];
  favorite: boolean;
  status: SaveStatus;
  trashedAt?: T;
  deleted: false;
  source: SaveSource;
  savedAt: T;
  createdAt: T;
  updatedAt: T;
  embedStatus: EmbedStatus;
  embedCheckedAt?: T;
  needsResolve: boolean;
  needsMeta: boolean;
  schemaVersion: number;
}

/** What a deleted save or collection becomes, so other devices learn about the delete. */
export interface Tombstone<T> {
  deleted: true;
  updatedAt: T;
  schemaVersion: number;
}

/** `/users/{uid}/collections/{cid}`. */
export interface CollectionDoc<T> {
  name: string;
  emoji?: string;
  color?: string;
  order: number;
  createdAt: T;
  updatedAt: T;
  deleted: false;
}

export interface UserSettings {
  view?: "grid" | "list";
  theme?: "system" | "light" | "dark";
  previews?: "ask" | "always" | "click";
  onUnsave?: "remove" | "keep";
}

/** `/users/{uid}`. */
export interface UserDoc<T> {
  email: string;
  displayName?: string;
  createdAt: T;
  updatedAt: T;
  settings: UserSettings;
  schemaVersion: number;
  /** Bumped to make every device do a full resync. */
  syncEpoch?: number;
  /** Set at the start of account deletion; lets the client delete live saves. */
  deleting?: boolean;
}

/** `/users/{uid}/imports/{jobId}`. `cursor` is the index of the next item in the file. */
export interface ImportDoc<T> {
  type: string;
  total: number;
  done: number;
  cursor: number;
  status: ImportStatus;
  error?: string;
  createdAt: T;
  updatedAt: T;
}

/** `/config/app`, written only by admin jobs. */
export interface AppConfig {
  minClientVersion: string;
  maintenance: boolean;
  notice?: string;
  disabledEmbeds: Platform[];
  importPaused: boolean;
  importDailyCap: number;
  inboxEnabled: boolean;
}

/**
 * A tag as stored: trimmed, lowercase, single spaces, no leading "#", no commas or control
 * characters, at most 40 UTF-16 units. Returns null when nothing is left.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .replace(/[\u0000-\u001F\u007F,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+/, "")
    .trim()
    .toLowerCase();
  if (!tag) return null;
  const chars = Array.from(tag);
  let out = "";
  for (const ch of chars) {
    if (out.length + ch.length > LIMITS.tagLength) break;
    out += ch;
  }
  return out.trim() || null;
}

/** Normalised, de-duplicated, capped tag list. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const r of raw) {
    const tag = normalizeTag(r);
    if (tag) seen.add(tag);
    if (seen.size === LIMITS.tags) break;
  }
  return [...seen];
}

export interface NewSaveOptions<T> {
  source: SaveSource;
  /** The server-time sentinel (`serverTimestamp()`); rules require createdAt/updatedAt to equal it. */
  now: T;
  /** Original save time, e.g. from an import file. Defaults to `now`. */
  savedAt?: T;
  tags?: readonly string[];
  note?: string;
}

/** A new save document for a parsed link, in the exact shape the rules accept. */
export function newSave<T>(link: ParsedLink, { source, now, savedAt, tags, note }: NewSaveOptions<T>): SaveDoc<T> {
  const trimmedNote = note?.trim().slice(0, LIMITS.note);
  return {
    url: link.canonicalUrl,
    originalUrl: link.originalUrl,
    platform: link.platform,
    kind: link.kind,
    platformId: link.platformId,
    ...(link.author ? { author: link.author.slice(0, LIMITS.author) } : {}),
    ...(trimmedNote ? { note: trimmedNote } : {}),
    tags: normalizeTags(tags ?? []),
    collectionIds: [],
    favorite: false,
    status: "active",
    deleted: false,
    source,
    savedAt: savedAt ?? now,
    createdAt: now,
    updatedAt: now,
    embedStatus: "unknown",
    needsResolve: link.needsResolve,
    needsMeta: true,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** The tombstone that replaces a deleted save or collection. */
export function tombstone<T>(now: T): Tombstone<T> {
  return { deleted: true, updatedAt: now, schemaVersion: SCHEMA_VERSION };
}

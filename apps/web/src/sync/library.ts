import { onSnapshot, query, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { TEXT_PLATFORM, type EmbedStatus, type Kind, type Platform, type SaveSource, type SaveStatus } from "@postsaver/core";
import { savesOf } from "../data/firestore.ts";

// The library as this device holds it. This listener reads only the device cache: it never
// costs a server read. The cache is filled by the delta listener in engine.ts (documents that
// changed on the server) and by this device's own writes. Documents evicted from the cache
// would never come back, which is why the cache is unlimited (data/firestore.ts).

interface SaveFields {
  id: string;
  /** The saved link; empty for a saved text. */
  url: string;
  originalUrl: string;
  kind: Kind;
  platformId: string | null;
  author?: string;
  title?: string;
  thumb?: string;
  note?: string;
  /** The id of its category, if it was given one (data/categories.ts). */
  category?: string;
  tags: string[];
  collectionIds: string[];
  favorite: boolean;
  status: SaveStatus;
  trashedAt?: Date;
  source: SaveSource;
  savedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  embedStatus: EmbedStatus;
  embedCheckedAt?: Date;
  needsResolve: boolean;
  needsMeta: boolean;
  schemaVersion: number;
  /** Changed on this device; the server hasn't confirmed it yet. */
  pending: boolean;
}

/** A saved post or page. */
export interface LinkSave extends SaveFields {
  platform: Platform;
  text?: undefined;
}

/** A saved piece of text: no link, no preview, nothing to look up. */
export interface TextSave extends SaveFields {
  platform: typeof TEXT_PLATFORM;
  text: string;
}

export type LibrarySave = LinkSave | TextSave;

export interface TombstoneRow {
  id: string;
  updatedAt?: Date;
}

export interface LibrarySnapshot {
  /** Live and trashed saves, newest saved first. */
  saves: LibrarySave[];
  tombstones: TombstoneRow[];
  /** Documents with local changes the server hasn't confirmed. */
  pendingCount: number;
}

const toDate = (value: unknown): Date | undefined =>
  value && typeof (value as { toDate?: unknown }).toDate === "function" ? (value as { toDate(): Date }).toDate() : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** Reads a save as this schema version understands it; unknown fields are ignored. */
export function toLibrarySave(id: string, data: DocumentData, pending: boolean): LibrarySave {
  const opt = (key: string) => {
    const value = str(data[key]);
    return value ? { [key]: value } : {};
  };
  const date = (key: string) => {
    const value = toDate(data[key]);
    return value ? { [key]: value } : {};
  };
  const fields: SaveFields = {
    id,
    url: str(data.url) ?? "",
    originalUrl: str(data.originalUrl) ?? str(data.url) ?? "",
    kind: (str(data.kind) as Kind | undefined) ?? "link",
    platformId: str(data.platformId) ?? null,
    ...opt("author"),
    ...opt("title"),
    ...opt("thumb"),
    ...opt("note"),
    ...opt("category"),
    tags: strings(data.tags),
    collectionIds: strings(data.collectionIds),
    favorite: data.favorite === true,
    status: data.status === "trashed" ? "trashed" : "active",
    ...date("trashedAt"),
    source: (str(data.source) as SaveSource | undefined) ?? "web",
    ...date("savedAt"),
    ...date("createdAt"),
    ...date("updatedAt"),
    embedStatus: data.embedStatus === "ok" || data.embedStatus === "unavailable" ? data.embedStatus : "unknown",
    ...date("embedCheckedAt"),
    needsResolve: data.needsResolve === true,
    needsMeta: data.needsMeta !== false,
    schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : 1,
    pending,
  };
  const text = str(data.text);
  if (data.platform === TEXT_PLATFORM && text) return { ...fields, platform: TEXT_PLATFORM, text, needsResolve: false, needsMeta: false };
  return { ...fields, platform: (str(data.platform) as Platform | undefined) ?? "web" };
}

function toSnapshot(docs: QueryDocumentSnapshot[]): LibrarySnapshot {
  const saves: LibrarySave[] = [];
  const tombstones: TombstoneRow[] = [];
  let pendingCount = 0;
  for (const d of docs) {
    const pending = d.metadata.hasPendingWrites;
    if (pending) pendingCount++;
    // A save made offline has no server time yet; "estimate" uses this device's clock meanwhile.
    const data = d.data({ serverTimestamps: "estimate" });
    if (data.deleted === true) tombstones.push({ id: d.id, ...(toDate(data.updatedAt) ? { updatedAt: toDate(data.updatedAt) } : {}) });
    else saves.push(toLibrarySave(d.id, data, pending));
  }
  saves.sort((a, b) => (b.savedAt?.getTime() ?? 0) - (a.savedAt?.getTime() ?? 0));
  return { saves, tombstones, pendingCount };
}

/** The whole library from the device cache, live. Returns the unsubscribe function. */
export function watchLibrary(uid: string, onChange: (snapshot: LibrarySnapshot) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(query(savesOf(uid)), { source: "cache", includeMetadataChanges: true }, (snap) => onChange(toSnapshot(snap.docs)), onError);
}

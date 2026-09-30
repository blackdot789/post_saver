import { toTime, type ImportItem, type ParsedFile } from "./types.ts";

// Instagram's "Download your information" export, the "Saved" part (CLAUDE.md §6.1). The ZIP
// holds saved_posts.json and saved_collections.json (or .html, when the person chose HTML).
// Instagram changes the layout of these files now and then, so nothing here depends on exact
// key names: every entry is searched for an Instagram link and a time.

const POST_LINK = /^https?:\/\/(www\.)?instagram\.com\/(?:[^/?#]+\/)?(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;

/** The files of the export that matter, by the end of their path inside the ZIP. */
export function isSavedFile(path: string): boolean {
  return /(^|\/)saved_(posts|collections)\.(json|html)$/i.test(path);
}

/**
 * Instagram writes non-ASCII text with each UTF-8 byte as its own character ("Ã©" for "é").
 * This puts it back, and leaves text that isn't such a mix-up alone.
 */
export function fixEncoding(text: string): string {
  if (!/[\u0080-ÿ]/.test(text) || /[^\u0000-ÿ]/.test(text)) return text;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(text, (c) => c.charCodeAt(0)));
  } catch {
    return text;
  }
}

interface Found {
  url?: string;
  time?: number;
}

/** The first Instagram post link and the first time anywhere inside a value. */
function search(value: unknown, found: Found = {}, depth = 0): Found {
  if (depth > 6 || (found.url && found.time)) return found;
  if (typeof value === "string") {
    if (!found.url && POST_LINK.test(value)) found.url = value;
  } else if (Array.isArray(value)) {
    for (const v of value) search(v, found, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === "number" && /time/i.test(key)) found.time ??= v;
      else search(v, found, depth + 1);
    }
  }
  return found;
}

/** The list inside an export file, whatever its top-level key is called. */
function entries(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const value of Object.values(data)) if (Array.isArray(value)) return value;
  }
  return [];
}

const nameOf = (entry: unknown): string | undefined => {
  const value = (entry as { string_map_data?: { Name?: { value?: unknown } } } | null)?.string_map_data?.Name?.value;
  return typeof value === "string" && value.trim() ? fixEncoding(value.trim()) : undefined;
};

function isCollectionHeading(entry: unknown): boolean {
  const e = entry as { title?: unknown; string_map_data?: Record<string, unknown> } | null;
  return e?.title === "Collection" || Object.keys(e?.string_map_data ?? {}).some((key) => /creation|update/i.test(key));
}

/** saved_posts.json: one entry per saved post. */
export function parseSavedPosts(data: unknown, now = Date.now()): { items: ImportItem[]; skipped: number } {
  const items: ImportItem[] = [];
  let skipped = 0;
  for (const entry of entries(data)) {
    const { url, time } = search(entry);
    if (!url) {
      skipped++;
      continue;
    }
    const savedAt = toTime(time, now);
    items.push({ url, ...(savedAt ? { savedAt } : {}) });
  }
  return { items, skipped };
}

/**
 * saved_collections.json: one flat list, in which an entry titled "Collection" (a name, no
 * link) starts a collection and the entries after it are the posts in it.
 */
export function parseSavedCollections(data: unknown, now = Date.now()): { items: ImportItem[]; skipped: number } {
  const items: ImportItem[] = [];
  let skipped = 0;
  let collection: string | undefined;
  for (const entry of entries(data)) {
    const { url, time } = search(entry);
    if (!url) {
      // A heading, or a post Instagram no longer has a link for.
      const name = isCollectionHeading(entry) ? nameOf(entry) : undefined;
      if (name) collection = name;
      else skipped++;
      continue;
    }
    const savedAt = toTime(time, now);
    items.push({ url, ...(savedAt ? { savedAt } : {}), ...(collection ? { collections: [collection] } : {}) });
  }
  return { items, skipped };
}

/** The HTML form of the export: every link to a post, without dates. */
export function parseSavedHtml(content: string): { items: ImportItem[]; skipped: number } {
  const items: ImportItem[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/href="([^"]+)"/gi)) {
    const url = (match[1] ?? "").replace(/&amp;/g, "&");
    if (POST_LINK.test(url) && !seen.has(url)) {
      seen.add(url);
      items.push({ url });
    }
  }
  return { items, skipped: 0 };
}

export function isInstagramJson(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return Object.keys(data).some((key) => /^saved_saved_(media|collections)$/.test(key));
}

/** The files of one export, by path (from the ZIP, or a single file picked directly). */
export function parseInstagramFiles(files: ReadonlyMap<string, string>, now = Date.now()): ParsedFile {
  const items: ImportItem[] = [];
  let skipped = 0;
  // Posts first, so a post's own save date wins over the date it was put in a collection.
  const ordered = [...files].sort(([a], [b]) => Number(/collections/i.test(a)) - Number(/collections/i.test(b)));
  for (const [path, content] of ordered) {
    let part: { items: ImportItem[]; skipped: number };
    if (/\.html?$/i.test(path)) part = parseSavedHtml(content);
    else {
      let data: unknown;
      try {
        data = JSON.parse(content);
      } catch {
        continue;
      }
      part = /collections/i.test(path) || (data && typeof data === "object" && "saved_saved_collections" in data) ? parseSavedCollections(data, now) : parseSavedPosts(data, now);
    }
    items.push(...part.items);
    skipped += part.skipped;
  }
  return { type: "instagram", items, skipped };
}

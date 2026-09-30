import { toTime, type ImportItem, type ParsedFile } from "./types.ts";

// Browser bookmark files ("Netscape bookmark file", what every browser and most bookmarking
// services export): nested <DL> lists, folders as <H3>, bookmarks as <A HREF ADD_DATE TAGS>.
// Read with a small tokenizer instead of the browser's HTML parser, so it runs in tests too.

/** Folders every browser has; being in one says nothing about a bookmark. */
const ROOT_FOLDERS = new Set([
  "bookmarks",
  "bookmarks bar",
  "bookmarks toolbar",
  "bookmarks menu",
  "other bookmarks",
  "mobile bookmarks",
  "favorites",
  "favorites bar",
  "favourites bar",
  "other favorites",
  "imported",
  "unsorted bookmarks",
  "reading list",
  "toolbar",
  "menu",
]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const text = (html: string) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : undefined;
}

const TOKEN = /<H3\b[^>]*>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>|<DL\b[^>]*>|<\/DL\s*>/gi;

export function isBookmarksFile(content: string): boolean {
  return /<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(content.slice(0, 2000)) || (/<DL\b/i.test(content) && /<A\b[^>]*\sHREF=/i.test(content));
}

export function parseBookmarks(content: string, now = Date.now()): ParsedFile {
  const items: ImportItem[] = [];
  let skipped = 0;
  // The folder each open <DL> belongs to (null for a list without a heading).
  const folders: Array<string | null> = [];
  let heading: string | null = null;

  for (const match of content.matchAll(TOKEN)) {
    const token = match[0];
    if (/^<H3/i.test(token)) {
      heading = text(match[1] ?? "");
    } else if (/^<DL/i.test(token)) {
      folders.push(heading);
      heading = null;
    } else if (/^<\/DL/i.test(token)) {
      folders.pop();
    } else {
      const tag = match[2] ?? "";
      const url = attr(tag, "HREF")?.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        skipped++;
        continue;
      }
      const title = text(match[3] ?? "");
      const savedAt = toTime(attr(tag, "ADD_DATE"), now);
      const tags = (attr(tag, "TAGS") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      // The innermost folder that isn't one of the browser's own.
      const folder = [...folders].reverse().find((f) => f && !ROOT_FOLDERS.has(f.toLowerCase()));
      items.push({
        url,
        ...(savedAt ? { savedAt } : {}),
        ...(title && title !== url ? { title } : {}),
        ...(tags.length ? { tags } : {}),
        ...(folder ? { collections: [folder] } : {}),
      });
    }
  }
  return { type: "bookmarks", items, skipped };
}

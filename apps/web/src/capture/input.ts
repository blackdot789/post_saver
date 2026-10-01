import { cleanText, extractSharedUrl, parse, type ParsedLink, type SaveSource } from "@postsaver/core";

// Sources a capture page may be told about with `?src=`. It's only a label, but the rules accept
// a fixed set, so anything else falls back to the page's own source.
const PAGE_SOURCES: readonly SaveSource[] = ["web", "share-android", "bookmarklet", "paste", "extension"];

export interface CaptureRequest {
  /** Whether anything was shared or passed in at all. */
  hasInput: boolean;
  /** What was shared, as text, for the "no link found" message. */
  sharedText: string;
  /** The link to save; null when there's no usable link in the input. */
  link: ParsedLink | null;
  /** Without a link: the shared words (title and text) to save as a text; null when there are none. */
  text: string | null;
  source: SaveSource;
}

/**
 * Reads `/save/?url=&text=&title=` (and the Android share target, which sends the same
 * fields). The link is the first one in url, then text, then title (CLAUDE.md §6.1). Words
 * shared without any link are saved as a text. The `url` field never is: a page address that
 * can't be stored (the bookmarklet on a browser's own page) isn't something to keep.
 */
export function readCapture(search: string, pageSource: SaveSource): CaptureRequest {
  const params = new URLSearchParams(search);
  const fields = { url: params.get("url"), text: params.get("text"), title: params.get("title") };
  const sharedText = [fields.title, fields.text, fields.url]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join("\n");
  const raw = extractSharedUrl(fields);
  const link = raw ? parse(raw) : null;
  const words = [fields.title, fields.text].filter((v) => v?.trim()).join("\n");
  const src = params.get("src") as SaveSource | null;
  return {
    hasInput: sharedText.length > 0,
    sharedText,
    link,
    text: link ? null : cleanText(words),
    source: src && PAGE_SOURCES.includes(src) ? src : pageSource,
  };
}

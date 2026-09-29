// Finding the link inside shared or pasted text. Android apps put it in `text`, often after a
// sentence ("Check out this video! https://…"), sometimes with CJK punctuation around it.

// Characters that end a URL: whitespace, quotes and brackets that never appear raw in URLs,
// CJK / full-width punctuation, and emoji (symbols, dingbats and every astral character).
const STOP =
  "\\s<>\"'`{}|\\\\^\\u00A0\\u2000-\\u200F\\u2028\\u2029\\u202F\\u205F\\u2600-\\u27BF\\u3000-\\u303F" +
  "\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\u201C\\u201D\\u2018\\u2019\\uD800-\\uDFFF";
const SCHEME_URL = new RegExp(`(?:https?|at|intent)://[^${STOP}]+`, "gi");
// Links typed without a scheme: "www.…" or a known platform host followed by a path.
const BARE_HOSTS =
  "instagram\\.com|instagr\\.am|x\\.com|twitter\\.com|tiktok\\.com|youtube\\.com|youtu\\.be|reddit\\.com|redd\\.it|" +
  "facebook\\.com|fb\\.watch|linkedin\\.com|lnkd\\.in|threads\\.com|threads\\.net|pinterest\\.[a-z.]{2,6}|pin\\.it|bsky\\.app";
// Group 1 is the character before the link (no lookbehind: older Safari can't parse it).
const BARE_URL = new RegExp(
  `(^|[\\s(\\[<"'“])(www\\.[^${STOP}]+|(?:[a-z0-9-]+\\.)*(?:${BARE_HOSTS})/[^${STOP}]*)`,
  "gi",
);
// A whole value that looks like "example.com/page" (the `url` param or a pasted line).
const LONE_HOST = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

const TRAILING = ".,;:!?*'\"";
const CLOSERS = new Map([
  [")", "("],
  ["]", "["],
  ["}", "{"],
]);

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}

/** Drops sentence punctuation after a URL, and a closing bracket that has no opening pair. */
function trimTrailing(url: string): string {
  let s = url;
  for (;;) {
    const last = s.at(-1);
    if (!last) return s;
    const opener = CLOSERS.get(last);
    if (TRAILING.includes(last) || (opener && count(s, last) > count(s, opener))) s = s.slice(0, -1);
    else return s;
  }
}

export interface FindOptions {
  /** Max links to return. */
  limit?: number;
  /** Also accept the whole value as a link when it's a single "host/path" token. */
  lone?: boolean;
}

/** Every link in free text, in order of appearance (e.g. the paste box). */
export function findUrls(text: string, { limit = Infinity, lone = false }: FindOptions = {}): string[] {
  const found: Array<{ index: number; end: number; url: string }> = [];
  const add = (raw: string, index: number) => {
    const url = trimTrailing(raw);
    if (url) found.push({ index, end: index + raw.length, url });
  };
  for (const m of text.matchAll(SCHEME_URL)) add(m[0], m.index);
  for (const m of text.matchAll(BARE_URL)) add(m[2] ?? "", m.index + (m[1]?.length ?? 0));
  found.sort((p, q) => p.index - q.index);

  const out: string[] = [];
  let covered = -1;
  for (const f of found) {
    if (f.index < covered) continue;
    covered = f.end;
    if (out.length < limit) out.push(f.url);
  }
  if (out.length === 0 && lone) {
    const s = text.trim();
    if (LONE_HOST.test(s)) out.push(trimTrailing(s));
  }
  return out;
}

export interface SharedInput {
  url?: string | null;
  text?: string | null;
  title?: string | null;
}

/**
 * The link inside a share (Web Share Target or `/save/?url=&text=&title=`): the first link in
 * `url`, then in `text`, then in `title`.
 */
export function extractSharedUrl({ url, text, title }: SharedInput): string | null {
  const sources: Array<[string | null | undefined, boolean]> = [
    [url, true],
    [text, false],
    [title, false],
  ];
  for (const [value, lone] of sources) {
    const hit = value ? findUrls(value, { limit: 1, lone })[0] : undefined;
    if (hit) return hit;
  }
  return null;
}

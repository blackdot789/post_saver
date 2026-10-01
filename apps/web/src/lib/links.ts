// The links inside a saved text, so they can be opened from the card. Only http(s) links become
// links (CLAUDE.md §6.9); everything else stays plain text.

export interface TextPart {
  text: string;
  /** Set when this part is a link. */
  href?: string;
}

const LINK = /https?:\/\/[^\s<>"'`]+/gi;
// Sentence punctuation after a link isn't part of it.
const TRAILING = /[.,;:!?*]+$/;

function trimLink(raw: string): string {
  let url = raw.replace(TRAILING, "");
  // A closing bracket belongs to the link only when its opening one is inside it.
  while (/[)\]}]$/.test(url)) {
    const close = url.at(-1) ?? "";
    const open = close === ")" ? "(" : close === "]" ? "[" : "{";
    if (url.split(open).length > url.split(close).length - 1) break;
    url = url.slice(0, -1).replace(TRAILING, "");
  }
  return url;
}

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** A text cut into its plain parts and its links, in order. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const match of text.matchAll(LINK)) {
    const url = trimLink(match[0]);
    const href = safeHref(url);
    if (!href) continue;
    if (match.index > at) parts.push({ text: text.slice(at, match.index) });
    parts.push({ text: url, href });
    at = match.index + url.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** The first line with something on it, for a one-line view of a text. */
export function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

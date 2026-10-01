import { cleanText, findUrls, parse, type ParsedLink } from "@postsaver/core";

// What a capture saves: a post's link, or a piece of text (to read and copy on another device).

export type Item = { link: ParsedLink; text?: never } | { text: string; link?: never };

/** Tells two items apart (the same link or the same text is the same item). */
export const itemKey = (item: Item): string => (item.link ? `link ${item.link.canonicalUrl}` : `text ${item.text}`);

export interface Pasted {
  /** The first link in what was typed or pasted, if any. */
  link: ParsedLink | null;
  /** The whole of it as a text to save; null when it's empty. */
  text: string | null;
  /** Nothing but a link: there's no question what to save. */
  onlyLink: boolean;
}

/** Reads what was typed or pasted into the box: a link, a text, or a text with a link in it. */
export function readPasted(value: string): Pasted {
  const raw = findUrls(value, { limit: 1, lone: true })[0];
  const link = raw ? parse(raw) : null;
  return { link, text: cleanText(value), onlyLink: link !== null && !/\s/.test(value.trim()) };
}

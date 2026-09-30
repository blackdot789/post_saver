// Small text helpers for reading other sites' pages and oEmbed answers. Deliberately not an
// HTML parser: the Worker has 10 ms of CPU per request, and only needs a few tags from <head>.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Tags out, <br> and paragraph ends as spaces, entities decoded, whitespace collapsed. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Collapses whitespace and cuts at `max` characters, on a word where possible, with "…". */
export function clip(text: string, max: number): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : undefined;
};

/** The `content` of the first <meta> whose property or name is one of `keys`, in that order of preference. */
export function metaContent(html: string, keys: readonly string[]): string | undefined {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content")?.trim();
    if (key && content && !found.has(key)) found.set(key, content);
  }
  for (const key of keys) {
    const value = found.get(key);
    if (value) return value;
  }
  return undefined;
}

export function titleTag(html: string): string | undefined {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = m ? textOf(m[1] ?? "") : "";
  return title || undefined;
}

/** Where a page sends the browser with <meta http-equiv="refresh">, as some shorteners do. */
export function metaRefresh(html: string): string | undefined {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(tag, "http-equiv")?.toLowerCase() !== "refresh") continue;
    const m = /^\s*\d*\s*[;,]?\s*url\s*=\s*['"]?([^'"]+)['"]?\s*$/i.exec(attr(tag, "content") ?? "");
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/**
 * The start of a response body as text: at most `maxBytes`, and no further than the end of
 * <head> when `untilHeadEnd` is set. The rest of the body is never downloaded.
 */
export async function readStart(response: Response, maxBytes: number, untilHeadEnd = false): Promise<string> {
  if (!response.body) return "";
  const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1];
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset ?? "utf-8");
  } catch {
    decoder = new TextDecoder();
  }
  const reader = response.body.getReader();
  let text = "";
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      const piece = decoder.decode(value, { stream: true });
      // Only the new piece (and a little before it) needs checking for the end of <head>.
      const from = Math.max(0, text.length - 8);
      text += piece;
      if (untilHeadEnd && /<\/head\s*>/i.test(text.slice(from))) break;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return text;
}

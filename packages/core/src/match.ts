import type { Embed, Kind, Platform, ResolveVia } from "./types.ts";
import { bareHost, cleanUrl, safeDecode } from "./url.ts";

/** What each platform matcher sees. */
export interface Ctx {
  url: URL;
  /** Lowercase host without a leading `www.`, `m.` or `mobile.`. */
  host: string;
  /** Decoded, non-empty path segments. */
  segs: string[];
  q: URLSearchParams;
}

export interface Match {
  platform: Platform;
  kind: Kind;
  platformId: string | null;
  canonicalUrl: string;
  author?: string;
  needsResolve?: ResolveVia;
  embed?: Embed | null;
}

/** Returns a match when `ctx` belongs to the matcher's platform, otherwise null. */
export type Matcher = (ctx: Ctx) => Match | null;

export function context(url: URL): Ctx {
  return {
    url,
    host: bareHost(url.hostname),
    segs: url.pathname.split("/").filter(Boolean).map(safeDecode),
    q: url.searchParams,
  };
}

/** A recognised platform URL that isn't a single post (explore pages, settings…): a link card. */
export function linkCard(ctx: Ctx, platform: Platform, kind: Kind = "link", author?: string): Match {
  return { platform, kind, platformId: null, canonicalUrl: cleanUrl(ctx.url).href, ...(author ? { author } : {}) };
}

/** A profile page with a canonical URL we build ourselves. */
export function profile(platform: Platform, canonicalUrl: string, author?: string): Match {
  return { platform, kind: "profile", platformId: null, canonicalUrl, ...(author ? { author } : {}) };
}

/** A short link that only the resolver Worker can expand. */
export function shortLink(ctx: Ctx, platform: Platform, kind: Kind): Match {
  return { platform, kind, platformId: null, canonicalUrl: cleanUrl(ctx.url).href, needsResolve: "redirect" };
}

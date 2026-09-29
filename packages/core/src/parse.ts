import { context, linkCard, shortLink, type Ctx, type Match, type Matcher } from "./match.ts";
import { bluesky } from "./platforms/bluesky.ts";
import { facebook } from "./platforms/facebook.ts";
import { instagram } from "./platforms/instagram.ts";
import { linkedin } from "./platforms/linkedin.ts";
import { pinterest } from "./platforms/pinterest.ts";
import { reddit } from "./platforms/reddit.ts";
import { threads } from "./platforms/threads.ts";
import { tiktok } from "./platforms/tiktok.ts";
import { x } from "./platforms/x.ts";
import { youtube } from "./platforms/youtube.ts";
import type { ParsedLink } from "./types.ts";
import { MAX_URL_LENGTH, toUrl, unwrapRedirect } from "./url.ts";

const MATCHERS: readonly Matcher[] = [instagram, x, tiktok, youtube, reddit, facebook, linkedin, threads, pinterest, bluesky];

/** Shorteners that can point anywhere, so the platform is only known after resolving. */
export const GENERIC_SHORTENERS: ReadonlySet<string> = new Set([
  "t.co", "lnkd.in", "bit.ly", "tinyurl.com", "t.ly", "buff.ly", "ow.ly", "is.gd", "dlvr.it", "trib.al",
  "cutt.ly", "rebrand.ly", "shorturl.at", "spoti.fi", "amzn.to", "a.co", "tiny.cc", "rb.gy",
]);

function web(ctx: Ctx): Match {
  if (GENERIC_SHORTENERS.has(ctx.host) && ctx.segs.length > 0) return shortLink(ctx, "web", "link");
  return linkCard(ctx, "web");
}

/**
 * Parses any shared or pasted link into its platform, stable id, canonical URL and embed.
 * Pure and offline. Returns null when the input isn't an http(s) link we can store.
 */
export function parse(input: string): ParsedLink | null {
  const original = toUrl(input);
  if (!original) return null;

  let url = original;
  for (let hop = 0; hop < 3; hop++) {
    const inner = unwrapRedirect(url);
    if (!inner) break;
    url = inner;
  }

  const ctx = context(url);
  let match: Match | null = null;
  for (const matcher of MATCHERS) {
    match = matcher(ctx);
    if (match) break;
  }
  const m = match ?? web(ctx);
  if (m.canonicalUrl.length > MAX_URL_LENGTH) return null;

  return {
    platform: m.platform,
    kind: m.kind,
    platformId: m.platformId,
    ...(m.author ? { author: m.author.slice(0, 100) } : {}),
    canonicalUrl: m.canonicalUrl,
    originalUrl: original.href.length <= MAX_URL_LENGTH ? original.href : m.canonicalUrl,
    needsResolve: !!m.needsResolve,
    ...(m.needsResolve ? { resolveVia: m.needsResolve } : {}),
    embed: m.embed ?? null,
  };
}

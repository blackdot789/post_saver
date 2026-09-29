import { linkCard, profile, shortLink, type Matcher } from "../match.ts";
import type { Kind } from "../types.ts";

const HOSTS = new Set(["instagram.com", "instagr.am", "ddinstagram.com", "kkinstagram.com"]);
const MEDIA = new Map<string, Kind>([
  ["p", "post"],
  ["reel", "reel"],
  ["reels", "reel"],
  ["tv", "video"],
]);
const PATHS = new Map<Kind, string>([
  ["post", "p"],
  ["reel", "reel"],
  ["video", "tv"],
]);
const CODE = /^[A-Za-z0-9_-]{8,64}$/;
const USER = /^[A-Za-z0-9._]{1,30}$/;
const RESERVED = new Set([
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "share", "s", "about",
  "developer", "legal", "emails", "web", "api", "graphql", "challenge", "oauth", "ar", "lite",
  "create", "invites", "directory", "topics", "locations", "privacy", "terms",
]);

export const instagram: Matcher = (ctx) => {
  if (!HOSTS.has(ctx.host)) return null;
  const [a, b, c] = ctx.segs;
  if (a === "share" && b) return shortLink(ctx, "instagram", MEDIA.get(b) ?? "post");

  // /p/{code}, /reel/{code}, /reels/{code}, /tv/{code}, and the same after /{user}/
  const withUser = !!a && !MEDIA.has(a) && !!b && MEDIA.has(b);
  const user = withUser ? a : undefined;
  const type = withUser ? b : a;
  const code = withUser ? c : b;
  const kind = type ? MEDIA.get(type) : undefined;
  if (kind && code && CODE.test(code) && (!user || (USER.test(user) && !RESERVED.has(user)))) {
    const author = user?.toLowerCase();
    return {
      platform: "instagram",
      kind,
      platformId: code,
      canonicalUrl: `https://www.instagram.com/${PATHS.get(kind)}/${code}/`,
      ...(author ? { author } : {}),
      embed: { platform: "instagram", code },
    };
  }

  if (a === "stories" && b && b !== "highlights" && USER.test(b)) {
    return linkCard(ctx, "instagram", "story", b.toLowerCase());
  }
  if (a === "stories" || a === "s") return linkCard(ctx, "instagram", "story");
  if (a && !b && !RESERVED.has(a) && USER.test(a)) {
    const user = a.toLowerCase();
    return profile("instagram", `https://www.instagram.com/${user}/`, user);
  }
  return linkCard(ctx, "instagram");
};

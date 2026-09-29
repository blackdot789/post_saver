import { linkCard, profile, shortLink, type Matcher } from "../match.ts";
import type { Kind } from "../types.ts";

const HOSTS = new Set(["tiktok.com", "tiktokv.com", "vxtiktok.com"]);
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);
const ID = /^\d{10,25}$/;
const USER = /^[A-Za-z0-9._]{1,40}$/;

export const tiktok: Matcher = (ctx) => {
  if (SHORT_HOSTS.has(ctx.host)) return shortLink(ctx, "tiktok", "video");
  if (!HOSTS.has(ctx.host)) return null;
  const [a, b, c] = ctx.segs;
  if (a === "t" && b) return shortLink(ctx, "tiktok", "video");

  let id: string | undefined;
  let user: string | undefined;
  let kind: Kind = "video";
  if (a?.startsWith("@") && (b === "video" || b === "photo")) {
    [user, id] = [a.slice(1), c];
    if (b === "photo") kind = "photo";
  } else if (a === "v" && b) id = b.replace(/\.html$/, "");
  else if (a === "embed") id = b === "v2" ? c : b;
  else if (a === "player" && b === "v1") id = c;
  else if (a === "share" && b === "video") id = c;
  else if (a === "video") id = b;

  if (id && ID.test(id)) {
    const author = user && USER.test(user) ? user.toLowerCase() : undefined;
    return {
      platform: "tiktok",
      kind,
      platformId: id,
      // TikTok ignores the username in this path, so "@" alone works when we don't know it.
      canonicalUrl: `https://www.tiktok.com/@${author ?? ""}/${kind}/${id}`,
      ...(author ? { author } : {}),
      embed: { platform: "tiktok", id },
    };
  }

  const handle = a?.startsWith("@") ? a.slice(1).toLowerCase() : undefined;
  if (handle && USER.test(handle)) {
    if (!b) return profile("tiktok", `https://www.tiktok.com/@${handle}`, handle);
    if (b === "live") return linkCard(ctx, "tiktok", "live", handle);
  }
  return linkCard(ctx, "tiktok");
};

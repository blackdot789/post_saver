import { linkCard, profile, shortLink, type Match, type Matcher } from "../match.ts";
import type { Kind } from "../types.ts";

const HOSTS = new Set([
  "facebook.com", "web.facebook.com", "mbasic.facebook.com", "touch.facebook.com",
  "business.facebook.com", "fb.com",
]);
const POST_ID = /^(?:\d{5,25}|pfbid0[A-Za-z0-9]{20,80})$/;
const NUM_ID = /^\d{5,25}$/;
const OWNER_ID = /^\d{1,25}$/;
const USER = /^[A-Za-z0-9.-]{1,80}$/;
const RESERVED = new Set([
  "watch", "reel", "reels", "groups", "events", "marketplace", "gaming", "share", "photo", "photo.php",
  "story.php", "permalink.php", "video.php", "login", "login.php", "pages", "profile.php", "hashtag",
  "help", "policies", "privacy", "settings", "notifications", "messages", "friends", "stories", "live",
  "plugins", "dialog", "sharer", "sharer.php", "home.php", "bookmarks", "saved", "search",
]);

function item(kind: Kind, id: string, canonicalUrl: string, author?: string): Match {
  const type = kind === "video" || kind === "reel" ? "video" : "post";
  return {
    platform: "facebook",
    kind,
    platformId: id,
    canonicalUrl,
    ...(author && !NUM_ID.test(author) ? { author } : {}),
    embed: { platform: "facebook", type, href: canonicalUrl },
  };
}

const numeric = (...candidates: Array<string | undefined>) => candidates.find((v) => v && NUM_ID.test(v));

export const facebook: Matcher = (ctx) => {
  if (ctx.host === "fb.watch" || ctx.host === "fb.gg") return shortLink(ctx, "facebook", "video");
  if (ctx.host === "fb.me") return shortLink(ctx, "facebook", "link");
  if (!HOSTS.has(ctx.host)) return null;
  const [a, b, c, d] = ctx.segs;
  const q = ctx.q;

  if (a === "share" && b) return shortLink(ctx, "facebook", b === "r" ? "reel" : b === "v" ? "video" : "post");

  if (a === "permalink.php" || a === "story.php") {
    const id = q.get("story_fbid");
    const owner = q.get("id");
    if (id && POST_ID.test(id) && owner && OWNER_ID.test(owner)) {
      return item("post", id, `https://www.facebook.com/permalink.php?story_fbid=${id}&id=${owner}`);
    }
  }
  if (a === "reel" && b && NUM_ID.test(b)) return item("reel", b, `https://www.facebook.com/reel/${b}`);
  if (a === "watch" || a === "video.php") {
    const v = q.get("v");
    if (v && NUM_ID.test(v)) return item("video", v, `https://www.facebook.com/watch/?v=${v}`);
  }
  if (a === "photo" || a === "photo.php") {
    const fbid = q.get("fbid");
    if (fbid && NUM_ID.test(fbid)) return item("photo", fbid, `https://www.facebook.com/photo/?fbid=${fbid}`);
  }
  if (a === "groups" && b && USER.test(b)) {
    if ((c === "posts" || c === "permalink") && d && POST_ID.test(d)) {
      // Group posts rarely allow embedding, so they show as a link card.
      return { platform: "facebook", kind: "post", platformId: d, canonicalUrl: `https://www.facebook.com/groups/${b}/posts/${d}/`, embed: null };
    }
    if (!c) return { platform: "facebook", kind: "community", platformId: null, canonicalUrl: `https://www.facebook.com/groups/${b}/` };
  }
  if (a === "profile.php") {
    const id = q.get("id");
    if (id && NUM_ID.test(id)) return profile("facebook", `https://www.facebook.com/profile.php?id=${id}`);
  }
  if (a === "stories") return linkCard(ctx, "facebook", "story");

  if (a && !RESERVED.has(a.toLowerCase()) && USER.test(a)) {
    if (b === "posts" && c && POST_ID.test(c)) return item("post", c, `https://www.facebook.com/${a}/posts/${c}`, a);
    if (b === "videos") {
      const id = numeric(d, c);
      if (id) return item("video", id, `https://www.facebook.com/${a}/videos/${id}/`, a);
    }
    if (b === "photos") {
      const id = numeric(d, c);
      if (id) return item("photo", id, `https://www.facebook.com/photo/?fbid=${id}`, a);
    }
    if (!b) return profile("facebook", `https://www.facebook.com/${a}`, NUM_ID.test(a) ? undefined : a);
  }
  return linkCard(ctx, "facebook");
};

import { linkCard, profile, type Matcher } from "../match.ts";

// x.com, twitter.com and the embed-fixer mirrors people share on chat apps. t.co is a generic
// shortener (it wraps every link in a post), handled in parse.ts.
const HOSTS = new Set([
  "x.com", "twitter.com", "fxtwitter.com", "fixupx.com", "vxtwitter.com", "fixvx.com",
  "twittpr.com", "xcancel.com", "nitter.net",
]);
const ID = /^\d{1,20}$/;
const USER = /^[A-Za-z0-9_]{1,50}$/;
const RESERVED = new Set([
  "i", "home", "explore", "search", "settings", "messages", "notifications", "compose", "intent",
  "share", "hashtag", "login", "logout", "signup", "tos", "privacy", "account", "jobs",
  "communities", "lists", "bookmarks",
]);

function isXHost(host: string): boolean {
  return HOSTS.has(host) || /\.(?:fxtwitter|fixupx|vxtwitter)\.com$/.test(host);
}

export const x: Matcher = (ctx) => {
  if (!isXHost(ctx.host)) return null;
  const [a, b, c, d] = ctx.segs;

  let id: string | undefined;
  let user: string | undefined;
  if (a === "i" && b === "web" && c === "status") id = d;
  else if (a === "i" && b === "status") id = c;
  else if (a && (b === "status" || b === "statuses")) [user, id] = [a, c];
  else if (a === "intent" && (b === "like" || b === "retweet")) id = ctx.q.get("tweet_id") ?? undefined;

  if (id && ID.test(id)) {
    const author = user && user !== "i" && USER.test(user) ? user : undefined;
    return {
      platform: "x",
      kind: "post",
      platformId: id,
      canonicalUrl: `https://x.com/${author ?? "i"}/status/${id}`,
      ...(author ? { author } : {}),
      embed: { platform: "x", id },
    };
  }

  if (a && !b && !RESERVED.has(a.toLowerCase()) && USER.test(a)) return profile("x", `https://x.com/${a}`, a);
  return linkCard(ctx, "x");
};

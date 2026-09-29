import { linkCard, profile, shortLink, type Match, type Matcher } from "../match.ts";

const HOSTS = new Set([
  "reddit.com", "old.reddit.com", "new.reddit.com", "np.reddit.com", "i.reddit.com", "sh.reddit.com",
  "amp.reddit.com", "rxddit.com", "vxreddit.com",
]);
const ID = /^[a-z0-9]{2,12}$/;
const SUB = /^[A-Za-z0-9_]{2,24}$/;
const USER = /^[A-Za-z0-9_-]{3,24}$/;

function post(id: string, cid: string | undefined, sub: string | undefined, user: string | undefined): Match {
  const base = sub
    ? `https://www.reddit.com/r/${sub}/comments/${id}/`
    : user
      ? `https://www.reddit.com/user/${user}/comments/${id}/`
      : `https://www.reddit.com/comments/${id}/`;
  return {
    platform: "reddit",
    kind: cid ? "comment" : "post",
    platformId: cid ? `${id}_${cid}` : id,
    canonicalUrl: cid ? `${base}comment/${cid}/` : base,
    ...(user ? { author: user } : {}),
    embed: {
      platform: "reddit",
      postId: id,
      ...(sub ? { subreddit: sub } : {}),
      ...(cid ? { commentId: cid } : {}),
    },
  };
}

export const reddit: Matcher = (ctx) => {
  const s = ctx.segs;
  if (ctx.host === "redd.it") {
    const id = s[0]?.toLowerCase();
    return id && ID.test(id) && s.length === 1 ? post(id, undefined, undefined, undefined) : linkCard(ctx, "reddit");
  }
  if (ctx.host === "v.redd.it" || ctx.host === "reddit.app.link") return shortLink(ctx, "reddit", "post");
  if (!HOSTS.has(ctx.host)) return null;

  let i = 0;
  let sub: string | undefined;
  let user: string | undefined;
  if (s[0] === "r" && s[1]) [sub, i] = [s[1], 2];
  else if ((s[0] === "u" || s[0] === "user") && s[1]) [user, i] = [s[1], 2];
  if (sub && !SUB.test(sub)) sub = undefined;
  if (user && !USER.test(user)) user = undefined;

  if (s[0] === "r" && s[2] === "s" && s[3]) return shortLink(ctx, "reddit", "post");
  if (s[i] === "comments" || s[i] === "gallery") {
    const id = s[i + 1]?.toLowerCase();
    if (id && ID.test(id)) {
      // /comments/{id}/{slug}/{cid}/ and /comments/{id}/comment/{cid}/
      const cid = s[i] === "comments" ? s[i + 3]?.toLowerCase() : undefined;
      return post(id, cid && ID.test(cid) ? cid : undefined, sub, user);
    }
  }
  if (sub && s.length === 2) return { platform: "reddit", kind: "community", platformId: null, canonicalUrl: `https://www.reddit.com/r/${sub}/` };
  if (user && s.length === 2) return profile("reddit", `https://www.reddit.com/user/${user}/`, user);
  return linkCard(ctx, "reddit");
};

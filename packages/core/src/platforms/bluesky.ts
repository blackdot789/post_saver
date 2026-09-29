import { linkCard, profile, type Matcher } from "../match.ts";

const HOSTS = new Set(["bsky.app", "fxbsky.app", "bskx.app"]);
const DID = /^did:(?:plc:[a-z2-7]{24}|web:[a-z0-9.-]+)$/;
const HANDLE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/;
const RKEY = /^[A-Za-z0-9._~:-]{1,64}$/;

export const bluesky: Matcher = (ctx) => {
  if (!HOSTS.has(ctx.host)) return null;
  const [a, b, c, d] = ctx.segs;
  const actor = a === "profile" && b ? b.toLowerCase() : undefined;
  const isDid = !!actor && DID.test(actor);
  if (!actor || (!isDid && !HANDLE.test(actor))) return linkCard(ctx, "bluesky");

  if (c === "post" && d && RKEY.test(d)) {
    const canonicalUrl = `https://bsky.app/profile/${actor}/post/${d}`;
    if (isDid) {
      return {
        platform: "bluesky",
        kind: "post",
        platformId: `${actor}_${d}`,
        canonicalUrl,
        embed: { platform: "bluesky", did: actor, rkey: d },
      };
    }
    // Handles can change, so the app looks up the DID (public API) before the id is final.
    return { platform: "bluesky", kind: "post", platformId: null, canonicalUrl, author: actor, needsResolve: "bsky-handle", embed: null };
  }
  if (!c) return profile("bluesky", `https://bsky.app/profile/${actor}`, isDid ? undefined : actor);
  return linkCard(ctx, "bluesky");
};

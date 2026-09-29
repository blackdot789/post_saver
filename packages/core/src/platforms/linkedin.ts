import { linkCard, profile, type Matcher } from "../match.ts";

const URN = /^urn:li:(activity|ugcPost|share):(\d{10,25})$/;
// Share URLs: /posts/{username}_{title-words}-activity-{id}-{suffix}
const SLUG = /-(activity|ugcPost|share)-(\d{10,25})-/;
// Vanity names allow letters, digits and hyphens, never underscores.
const USER = /^[\p{L}\p{N}-]{3,100}$/u;

const isLinkedInHost = (host: string) => host === "linkedin.com" || /^[a-z]{2}\.linkedin\.com$/.test(host);

export const linkedin: Matcher = (ctx) => {
  if (!isLinkedInHost(ctx.host)) return null;
  const [a, b, c, d] = ctx.segs;

  let urn: RegExpExecArray | null = null;
  let author: string | undefined;
  if (a === "feed" && b === "update" && c) urn = URN.exec(c);
  else if (a === "embed" && b === "feed" && c === "update" && d) urn = URN.exec(d);
  else if (a === "posts" && b) {
    urn = SLUG.exec(`-${b}-`);
    const user = b.includes("_") ? b.slice(0, b.indexOf("_")) : undefined;
    if (user && USER.test(user)) author = user;
  }

  if (urn?.[1] && urn[2]) {
    const [, type, id] = urn;
    return {
      platform: "linkedin",
      kind: "post",
      platformId: `${type}_${id}`,
      canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:${type}:${id}/`,
      ...(author ? { author } : {}),
      embed: { platform: "linkedin", urn: `urn:li:${type}:${id}` },
    };
  }

  if (a === "pulse" && b) return linkCard(ctx, "linkedin", "article");
  if (a === "in" && b && USER.test(b)) return profile("linkedin", `https://www.linkedin.com/in/${encodeURIComponent(b)}/`, b);
  if ((a === "company" || a === "school") && b && USER.test(b)) {
    return profile("linkedin", `https://www.linkedin.com/${a}/${encodeURIComponent(b)}/`);
  }
  return linkCard(ctx, "linkedin");
};

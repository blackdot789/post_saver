import { linkCard, profile, shortLink, type Matcher } from "../match.ts";

// pinterest.com, every country domain (pinterest.co.uk, pinterest.com.au, pinterest.de…) and
// country subdomains (in.pinterest.com).
const HOST = /^(?:[a-z]{2}\.)?pinterest\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const USER = /^[A-Za-z0-9_]{3,30}$/;
const RESERVED = new Set(["pin", "ideas", "search", "today", "settings", "business", "login", "_", "categories", "explore"]);

/** Pin ids are numeric; newer URLs put a title slug first: `/pin/{slug}--{id}/`. */
function pinId(seg: string): string | null {
  const slug = /--(\d{5,25})$/.exec(seg);
  if (slug?.[1]) return slug[1];
  return /^\d{5,25}$/.test(seg) ? seg : null;
}

export const pinterest: Matcher = (ctx) => {
  if (ctx.host === "pin.it") return shortLink(ctx, "pinterest", "pin");
  if (!HOST.test(ctx.host)) return null;
  const [a, b] = ctx.segs;

  const id = a === "pin" && b ? pinId(b) : null;
  if (id) {
    return {
      platform: "pinterest",
      kind: "pin",
      platformId: id,
      canonicalUrl: `https://www.pinterest.com/pin/${id}/`,
      embed: { platform: "pinterest", id },
    };
  }
  if (a && !b && !RESERVED.has(a) && USER.test(a)) return profile("pinterest", `https://www.pinterest.com/${a}/`, a);
  return linkCard(ctx, "pinterest");
};

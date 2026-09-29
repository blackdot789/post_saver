import { linkCard, profile, type Matcher } from "../match.ts";
import type { Kind } from "../types.ts";

const HOSTS = new Set(["youtube.com", "music.youtube.com", "gaming.youtube.com", "youtube-nocookie.com"]);
const ID = /^[A-Za-z0-9_-]{11}$/;
const LIST = /^[A-Za-z0-9_-]{2,64}$/;
const HANDLE = /^@[\p{L}\p{N}._-]{1,100}$/u;
const MAX_START = 24 * 3600;

/** YouTube start times: `90`, `90s`, `1m30s`, `1h2m3s`. Returns whole seconds, 0 if absent. */
export function parseStart(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!m) return 0;
  const secs = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return secs > 0 && secs <= MAX_START ? secs : 0;
}

export const youtube: Matcher = (ctx) => {
  const [a, b] = ctx.segs;
  let id: string | undefined;
  let kind: Kind = "video";
  if (ctx.host === "youtu.be") id = a;
  else if (!HOSTS.has(ctx.host)) return null;
  else if (a === "watch") id = ctx.q.get("v") ?? b;
  else if (a === "shorts") [id, kind] = [b, "short"];
  else if (a === "live") [id, kind] = [b, "live"];
  else if (a === "embed" || a === "v" || a === "e") id = b;

  if (id && ID.test(id)) {
    const hashT = new URLSearchParams(ctx.url.hash.slice(1)).get("t");
    const start = parseStart(ctx.q.get("t") ?? ctx.q.get("start") ?? hashT);
    let canonicalUrl = `https://www.youtube.com/${kind === "short" ? "shorts" : "live"}/${id}`;
    if (kind === "video") {
      const params = new URLSearchParams({ v: id });
      if (start) params.set("t", String(start));
      const list = ctx.q.get("list");
      if (list && LIST.test(list)) params.set("list", list);
      canonicalUrl = `https://www.youtube.com/watch?${params}`;
    }
    return {
      platform: "youtube",
      kind,
      platformId: id,
      canonicalUrl,
      embed: { platform: "youtube", id, ...(start ? { start } : {}) },
    };
  }

  if (ctx.host === "youtu.be") return linkCard(ctx, "youtube");
  if (a === "playlist") {
    const list = ctx.q.get("list");
    if (list && LIST.test(list)) {
      return { platform: "youtube", kind: "playlist", platformId: null, canonicalUrl: `https://www.youtube.com/playlist?list=${list}` };
    }
  }
  if (a && HANDLE.test(a) && !b) {
    return profile("youtube", `https://www.youtube.com/${encodeURIComponent(a).replace("%40", "@")}`, a.slice(1));
  }
  if ((a === "channel" || a === "c" || a === "user") && b && !ctx.segs[2]) {
    return profile("youtube", `https://www.youtube.com/${a}/${encodeURIComponent(b)}`);
  }
  return linkCard(ctx, "youtube");
};

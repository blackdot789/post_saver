import { linkCard, profile, type Matcher } from "../match.ts";

const HOSTS = new Set(["threads.com", "threads.net"]);
const CODE = /^[A-Za-z0-9_-]{8,64}$/;
const USER = /^[A-Za-z0-9._]{1,30}$/;

export const threads: Matcher = (ctx) => {
  if (!HOSTS.has(ctx.host)) return null;
  const [a, b, c] = ctx.segs;

  let user: string | undefined;
  let code: string | undefined;
  if (a?.startsWith("@") && b === "post") [user, code] = [a.slice(1), c];
  else if (a === "t") code = b;

  if (code && CODE.test(code) && (!user || USER.test(user))) {
    const author = user?.toLowerCase();
    return {
      platform: "threads",
      kind: "post",
      platformId: code,
      canonicalUrl: author ? `https://www.threads.com/@${author}/post/${code}` : `https://www.threads.com/t/${code}`,
      ...(author ? { author } : {}),
      embed: { platform: "threads", code, ...(author ? { user: author } : {}) },
    };
  }

  const handle = a?.startsWith("@") ? a.slice(1).toLowerCase() : undefined;
  if (handle && !b && USER.test(handle)) return profile("threads", `https://www.threads.com/@${handle}`, handle);
  return linkCard(ctx, "threads");
};

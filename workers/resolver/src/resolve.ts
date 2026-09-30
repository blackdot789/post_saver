import { parse } from "@postsaver/core";
import { BudgetError, type Fetcher } from "./fetcher.ts";
import { metaRefresh, readStart } from "./html.ts";
import { fetchable, isWall, MAX_URL_LENGTH } from "./safety.ts";

// GET /resolve: where a short link leads (CLAUDE.md §6.3). The URL engine in packages/core is
// the allowlist: only links it marks `resolveVia: "redirect"` are ever fetched, and that is
// re-checked on every hop. The page a short link leads to is never fetched, only named.

export type ResolveResult = { ok: true; finalUrl: string } | { ok: false; error: "bad_url" | "unresolved"; reason: string };

export const MAX_HOPS = 5;
/** A shortener's redirect page is tiny; this is plenty to find a <meta refresh> in. */
const REDIRECT_PAGE_BYTES = 16 * 1024;

/** Hosts a short link passes through on its way. They only redirect. */
const PASS_THROUGH: ReadonlySet<string> = new Set(["api.pinterest.com"]);

/** LinkedIn's "you're leaving LinkedIn" page names the destination in this link. */
function lnkdDestination(html: string): string | undefined {
  const tag = /<a\b[^>]*data-tracking-control-name="external_url_click"[^>]*>/i.exec(html)?.[0];
  return tag ? /\shref="([^"]+)"/i.exec(tag)?.[1]?.replace(/&amp;/g, "&") : undefined;
}

/** Where this response sends the browser: a Location header, or a redirect written into the page. */
async function nextOf(response: Response, at: URL): Promise<string | undefined> {
  if (response.status >= 300 && response.status < 400) return response.headers.get("location") ?? undefined;
  if (response.status !== 200 || !/html/i.test(response.headers.get("content-type") ?? "")) return undefined;
  const html = await readStart(response, REDIRECT_PAGE_BYTES);
  return metaRefresh(html) ?? (at.hostname === "lnkd.in" ? lnkdDestination(html) : undefined);
}

export async function resolve(raw: string, fetcher: Fetcher): Promise<ResolveResult> {
  const first = parse(raw);
  if (first?.resolveVia !== "redirect") return { ok: false, error: "bad_url", reason: "not a short link this service opens" };

  let current = first.canonicalUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const at = fetchable(current, { httpsOnly: true });
    if (!at) return { ok: false, error: "unresolved", reason: "unsafe hop" };

    let response: Response;
    try {
      response = await fetcher(at, { accept: "text/html,*/*;q=0.8" });
    } catch (error) {
      if (error instanceof BudgetError) throw error;
      return { ok: false, error: "unresolved", reason: "no answer" };
    }
    const location = await nextOf(response, at).catch(() => undefined);
    response.body?.cancel().catch(() => undefined);
    if (!location) return { ok: false, error: "unresolved", reason: `no redirect (${response.status})` };

    let next: URL;
    try {
      next = new URL(location, at);
    } catch {
      return { ok: false, error: "unresolved", reason: "bad redirect" };
    }
    if (next.href.length > MAX_URL_LENGTH || !fetchable(next.href, { httpsOnly: false })) return { ok: false, error: "unresolved", reason: "unsafe redirect" };
    if (isWall(next)) return { ok: false, error: "unresolved", reason: "sign-in wall" };

    const parsed = parse(next.href);
    if (!parsed) return { ok: false, error: "unresolved", reason: "bad redirect" };
    // Another short link (or the same one on https/www): keep following, within the limit.
    if (parsed.resolveVia === "redirect") current = parsed.canonicalUrl;
    else if (PASS_THROUGH.has(next.hostname)) current = next.href;
    // A platform's short link that ends on its home page (or some other page that isn't a
    // post or a profile) is a dead link, or a platform that didn't trust the caller.
    else if (first.platform !== "web" && parsed.kind === "link") return { ok: false, error: "unresolved", reason: "not a post" };
    else return { ok: true, finalUrl: next.href };
  }
  return { ok: false, error: "unresolved", reason: "too many hops" };
}

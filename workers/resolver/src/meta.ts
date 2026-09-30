import { META_PLATFORMS, parse, STABLE_THUMB_PREFIX, type LinkMeta, type ParsedLink } from "@postsaver/core";
import { BudgetError, UpstreamError, type Fetcher } from "./fetcher.ts";
import { clip, metaContent, readStart, textOf, titleTag } from "./html.ts";
import { fetchable, isWall } from "./safety.ts";

// GET /meta: a title and an author for a saved link (CLAUDE.md §6.3), from the platform's open
// oEmbed endpoint or public API, or from the page's own <head> for any other site. Nothing is
// fetched for Instagram, Facebook, Threads and LinkedIn: they offer nothing without a login.

type Meta = LinkMeta;

export type MetaResult = { ok: true; meta: Meta } | { ok: false; error: "bad_url" | "upstream"; reason: string };

const TITLE_MAX = 300;
const AUTHOR_MAX = 100;
/** How much of a page is read looking for its <head> tags. */
const PAGE_BYTES = 256 * 1024;
const PAGE_HOPS = 3;

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** An oEmbed (or API) answer. A post that's gone or private answers 4xx: that's "nothing", not a failure. */
async function getJson(url: string, fetcher: Fetcher): Promise<Json | null> {
  const response = await fetcher(url, { accept: "application/json" });
  if (response.status === 200) {
    const body: unknown = await response.json().catch(() => null);
    return body && typeof body === "object" ? (body as Json) : null;
  }
  response.body?.cancel().catch(() => undefined);
  if ([400, 401, 404, 410].includes(response.status)) return null;
  throw new UpstreamError(response.status);
}

const oembed = (endpoint: string, link: ParsedLink, fetcher: Fetcher, extra = "") =>
  getJson(`${endpoint}?url=${encodeURIComponent(link.canonicalUrl)}${extra}`, fetcher);

/** The last path segment of a profile address, without "@": x.com/jack → jack. */
function handleFrom(profileUrl: unknown): string | undefined {
  try {
    return new URL(String(profileUrl)).pathname.split("/").filter(Boolean).pop()?.replace(/^@/, "") || undefined;
  } catch {
    return undefined;
  }
}

function tidy(meta: { title?: string | undefined; author?: string | undefined; thumb?: string | undefined }): Meta {
  const title = meta.title ? clip(meta.title, TITLE_MAX) : "";
  const author = meta.author ? clip(meta.author, AUTHOR_MAX) : "";
  return {
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
    ...(meta.thumb?.startsWith(STABLE_THUMB_PREFIX) ? { thumb: meta.thumb } : {}),
  };
}

async function youtube(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const data = await oembed("https://www.youtube.com/oembed", link, fetcher, "&format=json");
  if (!data) return {};
  const id = link.embed?.platform === "youtube" ? link.embed.id : undefined;
  return tidy({ title: str(data.title), author: str(data.author_name), thumb: id ? `${STABLE_THUMB_PREFIX}vi/${id}/hqdefault.jpg` : undefined });
}

async function x(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const data = await oembed("https://publish.x.com/oembed", link, fetcher, "&omit_script=1&dnt=1");
  if (!data) return {};
  // The post's text is the first paragraph of the blockquote X hands out.
  const text = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(str(data.html) ?? "")?.[1];
  return tidy({ title: text ? textOf(text) : undefined, author: handleFrom(data.author_url) });
}

async function tiktok(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const data = await oembed("https://www.tiktok.com/oembed", link, fetcher);
  if (!data) return {};
  return tidy({ title: str(data.title), author: str(data.author_unique_id) ?? handleFrom(data.author_url) });
}

async function reddit(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const data = await oembed("https://www.reddit.com/oembed", link, fetcher);
  if (!data) return {};
  // Reddit's answer has no title field: the post's title is the first link of its blockquote.
  const first = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(str(data.html) ?? "")?.[1];
  return tidy({ title: str(data.title) ?? (first ? textOf(first) : undefined), author: str(data.author_name) });
}

async function pinterest(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const data = await oembed("https://www.pinterest.com/oembed.json", link, fetcher);
  return data ? tidy({ title: str(data.title), author: str(data.author_name) }) : {};
}

async function bluesky(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  if (link.embed?.platform !== "bluesky") return {};
  const uri = `at://${link.embed.did}/app.bsky.feed.post/${link.embed.rkey}`;
  const data = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, fetcher);
  const post = Array.isArray(data?.posts) ? (data.posts[0] as { record?: { text?: unknown }; author?: { handle?: unknown } } | undefined) : undefined;
  return post ? tidy({ title: str(post.record?.text), author: str(post.author?.handle) }) : {};
}

/** Sites with an open oEmbed endpoint that says more than their pages do. */
const WEB_OEMBED: Array<{ host: RegExp; endpoint: string }> = [
  { host: /(^|\.)spotify\.com$/, endpoint: "https://open.spotify.com/oembed" },
  { host: /(^|\.)vimeo\.com$/, endpoint: "https://vimeo.com/api/oembed.json" },
];

/** Any other site: its own og:/twitter: tags or <title>, read from the start of the page. */
async function page(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  let current = link.canonicalUrl;
  for (let hop = 0; hop <= PAGE_HOPS; hop++) {
    const at = fetchable(current, { httpsOnly: false });
    if (!at || isWall(at)) return {};
    const response = await fetcher(at, { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" });
    if (response.status >= 300 && response.status < 400) {
      response.body?.cancel().catch(() => undefined);
      const location = response.headers.get("location");
      if (!location) return {};
      try {
        current = new URL(location, at).href;
      } catch {
        return {};
      }
      continue;
    }
    if (response.status !== 200 || !/html/i.test(response.headers.get("content-type") ?? "")) {
      response.body?.cancel().catch(() => undefined);
      if (response.status === 429 || response.status >= 500) throw new UpstreamError(response.status);
      return {};
    }
    const html = await readStart(response, PAGE_BYTES, true);
    return tidy({
      title: metaContent(html, ["og:title", "twitter:title"]) ?? titleTag(html),
      author: metaContent(html, ["author", "article:author", "og:site_name"])?.replace(/^https?:\/\/\S+$/, ""),
    });
  }
  return {};
}

async function web(link: ParsedLink, fetcher: Fetcher): Promise<Meta> {
  const host = new URL(link.canonicalUrl).hostname;
  const open = WEB_OEMBED.find((o) => o.host.test(host));
  if (open) {
    const data = await oembed(open.endpoint, link, fetcher);
    if (data) return tidy({ title: str(data.title), author: str(data.author_name) });
  }
  return page(link, fetcher);
}

export async function meta(raw: string, fetcher: Fetcher): Promise<MetaResult> {
  const link = parse(raw);
  // A short link gets its metadata once it has been resolved into the post it points at.
  if (!link || link.needsResolve) return { ok: false, error: "bad_url", reason: "not a link this service describes" };
  if (!META_PLATFORMS.has(link.platform)) return { ok: true, meta: {} };
  // On a platform, only posts have something to say (profiles and other pages don't).
  if (link.platform !== "web" && !link.platformId) return { ok: true, meta: {} };
  try {
    switch (link.platform) {
      case "youtube":
        return { ok: true, meta: await youtube(link, fetcher) };
      case "x":
        return { ok: true, meta: await x(link, fetcher) };
      case "tiktok":
        return { ok: true, meta: await tiktok(link, fetcher) };
      case "reddit":
        return { ok: true, meta: await reddit(link, fetcher) };
      case "pinterest":
        return { ok: true, meta: await pinterest(link, fetcher) };
      case "bluesky":
        return { ok: true, meta: await bluesky(link, fetcher) };
      default:
        return { ok: true, meta: await web(link, fetcher) };
    }
  } catch (error) {
    if (error instanceof BudgetError) throw error;
    const reason = error instanceof UpstreamError ? `platform answered ${error.status}` : "no answer";
    return { ok: false, error: "upstream", reason };
  }
}

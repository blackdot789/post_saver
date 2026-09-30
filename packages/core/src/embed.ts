// The embed sandbox is told what to render through the URL fragment
// (https://embed.<domain>/#p=instagram&code=…). Both sides use this module: the host encodes
// a validated Embed, and the sandbox decodes the fragment and validates it again by rebuilding
// a link and parsing it (CLAUDE.md §6.6), so a crafted fragment can't make it render anything
// the URL engine wouldn't.
import { parse } from "./parse.ts";
import type { Embed } from "./types.ts";

export type EmbedTheme = "light" | "dark";

/** How the host wants a preview drawn. Presentation only: none of it decides what is rendered. */
export interface EmbedHints {
  theme: EmbedTheme;
  /** The tallest the host shows a preview, in CSS pixels. Renderers that pick their own height stay within it. */
  maxHeight?: number;
  /** An upright video (a YouTube Short): drawn 9:16 instead of 16:9. */
  tall?: boolean;
}

const MIN_HINT_HEIGHT = 200;
const MAX_HINT_HEIGHT = 2000;

/** The fragment parameters for an embed: `p` is the platform, the rest are the ids and the hints. */
export function embedToParams(embed: Embed, hints: EmbedTheme | EmbedHints): URLSearchParams {
  const { theme, maxHeight, tall }: EmbedHints = typeof hints === "string" ? { theme: hints } : hints;
  const params = new URLSearchParams();
  params.set("p", embed.platform);
  switch (embed.platform) {
    case "instagram":
      params.set("code", embed.code);
      break;
    case "x":
    case "tiktok":
    case "pinterest":
      params.set("id", embed.id);
      break;
    case "youtube":
      params.set("id", embed.id);
      if (embed.start) params.set("start", String(embed.start));
      break;
    case "reddit":
      params.set("id", embed.postId);
      if (embed.subreddit) params.set("sub", embed.subreddit);
      if (embed.commentId) params.set("comment", embed.commentId);
      break;
    case "facebook":
      params.set("type", embed.type);
      params.set("href", embed.href);
      break;
    case "linkedin":
      params.set("urn", embed.urn);
      break;
    case "threads":
      params.set("code", embed.code);
      if (embed.user) params.set("user", embed.user);
      break;
    case "bluesky":
      params.set("did", embed.did);
      params.set("rkey", embed.rkey);
      break;
  }
  params.set("theme", theme);
  if (maxHeight) params.set("max", String(Math.round(maxHeight)));
  if (tall) params.set("tall", "1");
  return params;
}

/** A link that parses to exactly this embed, used to validate a decoded one. */
export function linkForEmbed(embed: Embed): string {
  switch (embed.platform) {
    case "instagram":
      return `https://www.instagram.com/p/${embed.code}/`;
    case "x":
      return `https://x.com/i/status/${embed.id}`;
    case "tiktok":
      return `https://www.tiktok.com/@/video/${embed.id}`;
    case "youtube":
      return `https://www.youtube.com/watch?v=${embed.id}${embed.start ? `&t=${embed.start}` : ""}`;
    case "reddit": {
      const base = embed.subreddit ? `https://www.reddit.com/r/${embed.subreddit}/comments/${embed.postId}/` : `https://www.reddit.com/comments/${embed.postId}/`;
      return embed.commentId ? `${base}comment/${embed.commentId}/` : base;
    }
    case "facebook":
      return embed.href;
    case "linkedin":
      return `https://www.linkedin.com/feed/update/${embed.urn}/`;
    case "threads":
      return embed.user ? `https://www.threads.com/@${embed.user}/post/${embed.code}` : `https://www.threads.com/t/${embed.code}`;
    case "pinterest":
      return `https://www.pinterest.com/pin/${embed.id}/`;
    case "bluesky":
      return `https://bsky.app/profile/${embed.did}/post/${embed.rkey}`;
  }
}

function candidate(params: URLSearchParams): Embed | null {
  const get = (key: string) => params.get(key) ?? "";
  const opt = (key: string) => (params.get(key) ? { [key]: params.get(key) } : {});
  switch (params.get("p")) {
    case "instagram":
      return { platform: "instagram", code: get("code") };
    case "x":
      return { platform: "x", id: get("id") };
    case "tiktok":
      return { platform: "tiktok", id: get("id") };
    case "pinterest":
      return { platform: "pinterest", id: get("id") };
    case "youtube": {
      const start = Number(params.get("start") ?? 0);
      return { platform: "youtube", id: get("id"), ...(start > 0 && Number.isInteger(start) ? { start } : {}) };
    }
    case "reddit":
      return {
        platform: "reddit",
        postId: get("id"),
        ...(params.get("sub") ? { subreddit: get("sub") } : {}),
        ...(params.get("comment") ? { commentId: get("comment") } : {}),
      };
    case "facebook":
      return { platform: "facebook", type: get("type") === "video" ? "video" : "post", href: get("href") };
    case "linkedin":
      return { platform: "linkedin", urn: get("urn") };
    case "threads":
      return { platform: "threads", code: get("code"), ...(opt("user") as { user?: string }) };
    case "bluesky":
      return { platform: "bluesky", did: get("did"), rkey: get("rkey") };
    default:
      return null;
  }
}

function same(a: Embed, b: Embed): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

/**
 * The embed described by a fragment, or null when any id is off. The candidate is accepted
 * only if the link built from it parses back to the very same embed.
 */
export function paramsToEmbed(params: URLSearchParams): Embed | null {
  const embed = candidate(params);
  if (!embed) return null;
  const parsed = parse(linkForEmbed(embed));
  return parsed?.embed && same(parsed.embed, embed) ? parsed.embed : null;
}

export function themeFromParams(params: URLSearchParams): EmbedTheme {
  return params.get("theme") === "dark" ? "dark" : "light";
}

/** The hints in a fragment. Anything odd is dropped, so they can only ever change sizes and colours. */
export function hintsFromParams(params: URLSearchParams): EmbedHints {
  const max = Number(params.get("max"));
  return {
    theme: themeFromParams(params),
    ...(Number.isInteger(max) && max >= MIN_HINT_HEIGHT && max <= MAX_HINT_HEIGHT ? { maxHeight: max } : {}),
    ...(params.get("tall") === "1" ? { tall: true } : {}),
  };
}

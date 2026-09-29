/** Every platform the URL engine recognises. "web" is any other site, shown as a link card. */
export const PLATFORMS = [
  "instagram",
  "x",
  "tiktok",
  "youtube",
  "reddit",
  "facebook",
  "linkedin",
  "threads",
  "pinterest",
  "bluesky",
  "web",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** What a saved link points at. Only a display hint; identity comes from `platformId`. */
export const KINDS = [
  "post",
  "reel",
  "video",
  "short",
  "live",
  "photo",
  "pin",
  "comment",
  "story",
  "profile",
  "community",
  "playlist",
  "article",
  "link",
] as const;
export type Kind = (typeof KINDS)[number];

/** How a link that can't be identified offline gets its final form. */
export type ResolveVia =
  /** Short link: the resolver Worker follows its redirects. */
  | "redirect"
  /** Bluesky handle: the browser looks up the DID, because handles can change. */
  | "bsky-handle";

/**
 * What the embed sandbox needs to render a post. Built only from ids the parser validated,
 * never from raw HTML or unchecked URL parts.
 */
export type Embed =
  | { platform: "instagram"; code: string }
  | { platform: "x"; id: string }
  | { platform: "tiktok"; id: string }
  | { platform: "youtube"; id: string; start?: number }
  | { platform: "reddit"; postId: string; subreddit?: string; commentId?: string }
  | { platform: "facebook"; type: "post" | "video"; href: string }
  | { platform: "linkedin"; urn: string }
  | { platform: "threads"; code: string; user?: string }
  | { platform: "pinterest"; id: string }
  | { platform: "bluesky"; did: string; rkey: string };

export interface ParsedLink {
  platform: Platform;
  kind: Kind;
  /** Stable id on the platform; null for generic links and links that still need resolving. */
  platformId: string | null;
  /** Username or handle when the URL contains one. */
  author?: string;
  /** Clean URL we store and open: tracking removed, rebuilt from ids for known platforms. */
  canonicalUrl: string;
  /** The URL as it was shared (scheme added if it was missing). */
  originalUrl: string;
  needsResolve: boolean;
  resolveVia?: ResolveVia;
  /** Null means "show a link card". */
  embed: Embed | null;
}

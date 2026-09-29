import type { Kind, Platform } from "@postsaver/core";

/** Platform names as the platforms write them, only to say where a post is from. */
export const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  web: "Web",
};

const KIND_NAMES: Record<Kind, string> = {
  post: "post",
  reel: "reel",
  video: "video",
  short: "Short",
  live: "live video",
  photo: "photo",
  pin: "Pin",
  comment: "comment",
  story: "story",
  profile: "profile",
  community: "community",
  playlist: "playlist",
  article: "article",
  link: "page",
};

/** "Instagram reel", "YouTube Short", "Reddit comment"; any other site is a "Link". */
export function describeLink({ platform, kind }: { platform: Platform; kind: Kind }): string {
  if (platform === "web") return "Link";
  return `${PLATFORM_NAMES[platform]} ${KIND_NAMES[kind]}`;
}

const HANDLES = new Set<Platform>(["instagram", "x", "tiktok", "threads", "bluesky"]);

/** How the platform writes a username: "@natgeo", "u/spez", or the page name as is. */
export function authorLabel(platform: Platform, author: string): string {
  if (platform === "reddit") return `u/${author}`;
  return HANDLES.has(platform) ? `@${author}` : author;
}

/** The host to show for a link, without "www.". */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "12 Sep", or "12 Sep 2025" outside the current year, in the reader's language. */
export function formatDay(date: Date, now = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

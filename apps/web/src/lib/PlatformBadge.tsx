import type { Platform } from "@postsaver/core";
import { siBluesky, siFacebook, siInstagram, siPinterest, siReddit, siThreads, siTiktok, siX, siYoutube } from "simple-icons";
import { PLATFORM_NAMES } from "./platforms.ts";
import { cx } from "../ui/cx.ts";

// Platform names, marks and colours only say where a post is from (CLAUDE.md §6.8). The marks
// are Simple Icons' single-colour versions; LinkedIn's isn't in that set, so it is drawn here.

const LINKEDIN =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

/** The mark's path (24×24) and its colour; black marks turn white on dark backgrounds. */
const MARKS: Record<Exclude<Platform, "web">, { path: string; color: string }> = {
  instagram: { path: siInstagram.path, color: "text-[#E1306C]" },
  x: { path: siX.path, color: "text-black dark:text-white" },
  tiktok: { path: siTiktok.path, color: "text-black dark:text-white" },
  youtube: { path: siYoutube.path, color: "text-[#FF0000]" },
  reddit: { path: siReddit.path, color: "text-[#FF4500]" },
  facebook: { path: siFacebook.path, color: "text-[#0866FF]" },
  linkedin: { path: LINKEDIN, color: "text-[#0A66C2] dark:text-[#4C9BE8]" },
  threads: { path: siThreads.path, color: "text-black dark:text-white" },
  pinterest: { path: siPinterest.path, color: "text-[#E60023]" },
  bluesky: { path: siBluesky.path, color: "text-[#1185FE]" },
};

/** The platform's mark, or a globe for any other site; 16 px unless a size class is given. */
export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform === "web") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={cx("shrink-0 text-slate-500 dark:text-slate-400", className ?? "size-4")}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
      </svg>
    );
  }
  const mark = MARKS[platform];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={cx("shrink-0", mark.color, className ?? "size-4")}>
      <path d={mark.path} />
    </svg>
  );
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold", className)}>
      <PlatformIcon platform={platform} />
      {PLATFORM_NAMES[platform]}
    </span>
  );
}

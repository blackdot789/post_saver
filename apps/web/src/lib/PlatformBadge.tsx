import type { Platform } from "@postsaver/core";
import { PLATFORM_NAMES } from "./platforms.ts";
import { cx } from "../ui/cx.ts";

// Platform names and colours only say where a post is from (CLAUDE.md §6.8).
const COLORS: Record<Platform, string> = {
  instagram: "bg-[#E1306C]",
  x: "bg-black dark:bg-white",
  tiktok: "bg-[#010101] dark:bg-[#69C9D0]",
  youtube: "bg-[#FF0000]",
  reddit: "bg-[#FF4500]",
  facebook: "bg-[#1877F2]",
  linkedin: "bg-[#0A66C2]",
  threads: "bg-black dark:bg-white",
  pinterest: "bg-[#E60023]",
  bluesky: "bg-[#1185FE]",
  web: "bg-slate-400",
};

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block size-2.5 shrink-0 rounded-full", COLORS[platform], className)} />;
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-semibold", className)}>
      <PlatformDot platform={platform} />
      {PLATFORM_NAMES[platform]}
    </span>
  );
}

import type { Kind, Platform } from "@postsaver/core";

// One size rule for every platform (CLAUDE.md §6.6 "Card sizes"): a preview is as tall as its
// post, up to the height of a 4:5 post under a header strip. Anything taller is cut there, with
// "Show full post" under it. These are pure functions: the card, the sandbox hint and the grid's
// layout all read the same numbers.

/** Instagram's header strip. The tallest preview is a 4:5 post under it. */
const HEADER_STRIP = 54;
/** A preview this much over the limit is still shown whole, rather than cut for a sliver. */
const SLACK = 56;
/** A cut that would hide less than this isn't worth a button. */
const MIN_HIDDEN = 24;
const MIN_PLAYER = 200;

/** What the sandbox reported: the embed's full height, and where the post itself ends. */
export interface PreviewSize {
  height: number;
  fold?: number;
}

/** The tallest a preview is shown in a card this wide. */
export function maxPreviewHeight(width: number): number {
  return Math.round(width * 1.25) + HEADER_STRIP;
}

/** The space to keep for a preview before it has loaded, so the card doesn't jump. */
export function initialPreviewHeight(platform: Platform, kind: Kind, width: number): number {
  const max = maxPreviewHeight(width);
  const upright = Math.min(Math.round((width * 16) / 9), max);
  switch (platform) {
    case "youtube":
      return kind === "short" ? Math.max(MIN_PLAYER, upright) : Math.max(MIN_PLAYER, Math.round((width * 9) / 16));
    case "tiktok":
      return upright;
    // Most Instagram posts are 4:5 or reels, which land exactly on the limit.
    case "instagram":
    case "linkedin":
      return max;
    case "facebook":
    case "pinterest":
      return Math.min(420, max);
    default:
      return Math.min(300, max);
  }
}

/** How much of a preview is shown while it's folded, and whether that hides anything. */
export function fitPreview(size: PreviewSize, max: number): { shown: number; cut: boolean } {
  const natural = size.fold && size.fold < size.height ? size.fold : size.height;
  const shown = natural > max + SLACK ? max : natural;
  return { shown, cut: size.height - shown >= MIN_HIDDEN };
}

import { describe, expect, it } from "vitest";
import { fitPreview, initialPreviewHeight, maxPreviewHeight } from "./sizing.ts";

describe("preview sizes", () => {
  it("the tallest preview is a 4:5 post under a header strip", () => {
    expect(maxPreviewHeight(320)).toBe(454);
    expect(maxPreviewHeight(358)).toBe(502);
  });

  it("keeps the right space before a preview loads", () => {
    // Instagram reels and 4:5 posts land exactly on the limit.
    expect(initialPreviewHeight("instagram", "reel", 320)).toBe(454);
    // YouTube: 16:9, never under the 200 px YouTube asks for; a Short stands upright within the limit.
    expect(initialPreviewHeight("youtube", "video", 480)).toBe(270);
    expect(initialPreviewHeight("youtube", "video", 320)).toBe(200);
    expect(initialPreviewHeight("youtube", "short", 320)).toBe(454);
    expect(initialPreviewHeight("tiktok", "video", 320)).toBe(454);
    expect(initialPreviewHeight("x", "post", 320)).toBe(300);
    // Every platform stays within the limit.
    for (const platform of ["instagram", "x", "tiktok", "youtube", "reddit", "facebook", "linkedin", "threads", "pinterest", "bluesky"] as const) {
      expect(initialPreviewHeight(platform, "post", 300)).toBeLessThanOrEqual(maxPreviewHeight(300));
    }
  });

  it("folds an Instagram post at the end of its media", () => {
    const max = maxPreviewHeight(320);
    // A reel: header 54 + media 400, then 154 px of Instagram's footer.
    expect(fitPreview({ height: 608, fold: 454 }, max)).toEqual({ shown: 454, cut: true });
    // A square photo is shorter than the limit and still folds at its media.
    expect(fitPreview({ height: 528, fold: 374 }, max)).toEqual({ shown: 374, cut: true });
  });

  it("cuts a tall post at the limit, and leaves one that's only a little taller whole", () => {
    const max = maxPreviewHeight(320);
    expect(fitPreview({ height: 900 }, max)).toEqual({ shown: max, cut: true });
    expect(fitPreview({ height: max + 40 }, max)).toEqual({ shown: max + 40, cut: false });
    expect(fitPreview({ height: 231 }, max)).toEqual({ shown: 231, cut: false });
  });

  it("ignores a fold that isn't inside the embed, or that would hide only a sliver", () => {
    expect(fitPreview({ height: 300, fold: 300 }, 454)).toEqual({ shown: 300, cut: false });
    expect(fitPreview({ height: 300, fold: 290 }, 454)).toEqual({ shown: 290, cut: false });
  });
});

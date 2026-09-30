import { describe, expect, it } from "vitest";
import { bookmarkletHref } from "./bookmarklet.ts";
import { readCapture } from "./input.ts";

/** Runs the bookmark's code on a pretend page. */
function click(href: string, pageUrl: string, popupsAllowed: boolean) {
  const opened: Array<{ url: string; name: string; features: string }> = [];
  const location = { href: pageUrl };
  const window = {
    open(url: string, name: string, features: string) {
      opened.push({ url, name, features });
      return popupsAllowed ? {} : null;
    },
  };
  new Function("location", "window", decodeURIComponent(href.slice("javascript:".length)))(location, window);
  return { opened, location };
}

describe("the bookmarklet", () => {
  const href = bookmarkletHref("https://app.example");

  it("is one javascript: link with nothing a bookmarks bar would choke on", () => {
    expect(href.startsWith("javascript:")).toBe(true);
    expect(href).not.toMatch(/[\s"<>]/);
  });

  it("opens the save page for the page being viewed, in a small window", () => {
    const page = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";
    const { opened, location } = click(href, page, true);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.features).toBe("width=420,height=560");
    expect(location.href).toBe(page);
    // The save page reads the link back exactly, and labels the save as coming from the bookmark.
    const saveUrl = new URL(opened[0]?.url ?? "");
    expect(saveUrl.origin + saveUrl.pathname).toBe("https://app.example/save/");
    const capture = readCapture(saveUrl.search, "web");
    expect(capture.source).toBe("bookmarklet");
    expect(capture.link?.canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42");
  });

  it("falls back to the same tab when the window is blocked", () => {
    const { location } = click(href, "https://example.com/a?b=c#d", false);
    expect(location.href).toBe(`https://app.example/save/?src=bookmarklet&url=${encodeURIComponent("https://example.com/a?b=c#d")}`);
  });
});

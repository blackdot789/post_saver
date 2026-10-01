import { describe, expect, it } from "vitest";
import { authorLabel, describeLink, displayHost, formatDay } from "../lib/platforms.ts";
import { readCapture } from "./input.ts";
import { itemKey, readPasted } from "./item.ts";

describe("readCapture", () => {
  it("finds the link Android apps put inside the shared text", () => {
    const req = readCapture(
      "?" + new URLSearchParams({ text: "Check this out! https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUx" }),
      "share-android",
    );
    expect(req.hasInput).toBe(true);
    expect(req.source).toBe("share-android");
    expect(req.link?.canonicalUrl).toBe("https://www.instagram.com/reel/C8xYz12AbCd/");
  });

  it("prefers the url field, and accepts a bare host there", () => {
    const req = readCapture("?" + new URLSearchParams({ url: "youtu.be/dQw4w9WgXcQ", text: "https://example.com/other" }), "web");
    expect(req.link?.platform).toBe("youtube");
  });

  it("takes words shared without a link as a text to save", () => {
    const req = readCapture("?" + new URLSearchParams({ title: "My notes", text: "no link in here\r\nsecond line  " }), "share-android");
    expect(req).toMatchObject({ hasInput: true, link: null, text: "My notes\nno link in here\nsecond line", source: "share-android" });
    expect(readCapture("?" + new URLSearchParams({ text: "Gate code 4821#" }), "web").text).toBe("Gate code 4821#");
  });

  it("a link anywhere in the share wins over its words", () => {
    const req = readCapture("?" + new URLSearchParams({ title: "Great video", text: "Watch https://youtu.be/dQw4w9WgXcQ now" }), "share-android");
    expect(req.link?.platform).toBe("youtube");
    expect(req.text).toBeNull();
  });

  it("never saves the url field as a text (a page address that can't be stored)", () => {
    const req = readCapture("?" + new URLSearchParams({ url: "chrome://settings", src: "bookmarklet" }), "web");
    expect(req).toMatchObject({ hasInput: true, link: null, text: null, sharedText: "chrome://settings" });
  });

  it("no input at all", () => {
    expect(readCapture("", "web")).toMatchObject({ hasInput: false, link: null, text: null, sharedText: "" });
    expect(readCapture("?url=%20%20", "web").hasInput).toBe(false);
    expect(readCapture("?text=%20%0A", "web")).toMatchObject({ hasInput: false, text: null });
  });

  it("takes a known ?src= and ignores anything else", () => {
    const url = "https://x.com/user/status/1234567890123456789";
    expect(readCapture("?" + new URLSearchParams({ url, src: "bookmarklet" }), "web").source).toBe("bookmarklet");
    expect(readCapture("?" + new URLSearchParams({ url, src: "import-evil" }), "web").source).toBe("web");
    expect(readCapture("?" + new URLSearchParams({ url, src: "Web" }), "paste").source).toBe("paste");
  });
});

describe("readPasted", () => {
  it("a link by itself is a link, also without its scheme", () => {
    expect(readPasted("  https://www.instagram.com/reel/C8xYz12AbCd/?igsh=x \n")).toMatchObject({ onlyLink: true, link: { platform: "instagram" } });
    expect(readPasted("youtu.be/dQw4w9WgXcQ")).toMatchObject({ onlyLink: true, link: { platform: "youtube" } });
  });

  it("words are a text", () => {
    expect(readPasted(" Gate code 4821#\nSecond door ")).toEqual({ link: null, text: " Gate code 4821#\nSecond door", onlyLink: false });
    expect(readPasted("not a link")).toMatchObject({ link: null, text: "not a link" });
  });

  it("words with a link in them could be either", () => {
    const pasted = readPasted("Check out this reel! https://www.instagram.com/reel/C8xYz12AbCd/");
    expect(pasted.onlyLink).toBe(false);
    expect(pasted.link?.canonicalUrl).toBe("https://www.instagram.com/reel/C8xYz12AbCd/");
    expect(pasted.text).toBe("Check out this reel! https://www.instagram.com/reel/C8xYz12AbCd/");
  });

  it("nothing is nothing", () => {
    expect(readPasted("  \n ")).toEqual({ link: null, text: null, onlyLink: false });
  });
});

describe("itemKey", () => {
  it("tells links and texts apart, and the same thing from itself never", () => {
    const { link } = readPasted("https://example.com/a");
    if (!link) throw new Error("no link");
    expect(itemKey({ link })).toBe(itemKey({ link: { ...link } }));
    expect(itemKey({ text: "https://example.com/a" })).not.toBe(itemKey({ link }));
    expect(itemKey({ text: "a" })).not.toBe(itemKey({ text: "b" }));
  });
});

describe("describeLink", () => {
  it.each([
    ["instagram", "reel", "Instagram reel"],
    ["youtube", "short", "YouTube Short"],
    ["x", "post", "X post"],
    ["reddit", "comment", "Reddit comment"],
    ["pinterest", "pin", "Pinterest Pin"],
    ["instagram", "link", "Instagram page"],
    ["web", "link", "Link"],
    ["text", "link", "Text"],
  ] as const)("%s %s → %s", (platform, kind, text) => {
    expect(describeLink({ platform, kind })).toBe(text);
  });
});

describe("authorLabel", () => {
  it("writes names the way each platform does", () => {
    expect(authorLabel("instagram", "natgeo")).toBe("@natgeo");
    expect(authorLabel("reddit", "spez")).toBe("u/spez");
    expect(authorLabel("facebook", "NASA")).toBe("NASA");
  });
});

describe("displayHost", () => {
  it("drops www. and survives junk", () => {
    expect(displayHost("https://www.example.com/a?b")).toBe("example.com");
    expect(displayHost("not a url")).toBe("not a url");
  });
});

describe("formatDay", () => {
  const now = new Date(2026, 8, 29);
  it("leaves out the year when it's this year", () => {
    expect(formatDay(new Date(2026, 8, 12), now)).not.toMatch(/2026/);
    expect(formatDay(new Date(2025, 8, 12), now)).toMatch(/2025/);
  });
});

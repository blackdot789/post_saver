import { describe, expect, it } from "vitest";
import { authorLabel, describeLink, displayHost, formatDay } from "../lib/platforms.ts";
import { readCapture } from "./input.ts";

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

  it("reports input without a link", () => {
    const req = readCapture("?" + new URLSearchParams({ title: "My notes", text: "no link in here" }), "web");
    expect(req).toMatchObject({ hasInput: true, link: null, sharedText: "My notes\nno link in here" });
  });

  it("no input at all", () => {
    expect(readCapture("", "web")).toMatchObject({ hasInput: false, link: null, sharedText: "" });
    expect(readCapture("?url=%20%20", "web").hasInput).toBe(false);
  });

  it("takes a known ?src= and ignores anything else", () => {
    const url = "https://x.com/user/status/1234567890123456789";
    expect(readCapture("?" + new URLSearchParams({ url, src: "bookmarklet" }), "web").source).toBe("bookmarklet");
    expect(readCapture("?" + new URLSearchParams({ url, src: "import-evil" }), "web").source).toBe("web");
    expect(readCapture("?" + new URLSearchParams({ url, src: "Web" }), "paste").source).toBe("paste");
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

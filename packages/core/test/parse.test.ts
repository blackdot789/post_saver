import { describe, expect, it } from "vitest";
import { KINDS, MAX_URL_LENGTH, PLATFORMS, parse, type ParsedLink } from "../src/index.ts";
import { facebook } from "./fixtures/facebook.ts";
import { instagram } from "./fixtures/instagram.ts";
import { linkedin } from "./fixtures/linkedin.ts";
import { reddit } from "./fixtures/reddit.ts";
import { bluesky, pinterest, threads } from "./fixtures/threads-pinterest-bluesky.ts";
import { tiktok } from "./fixtures/tiktok.ts";
import type { Fixture } from "./fixtures/types.ts";
import { invalid, web } from "./fixtures/web.ts";
import { x } from "./fixtures/x.ts";
import { youtube } from "./fixtures/youtube.ts";

const groups: Record<string, Fixture[]> = { instagram, x, tiktok, youtube, reddit, facebook, linkedin, threads, pinterest, bluesky, web };
const all = Object.values(groups).flat();

function mustParse(input: string): ParsedLink {
  const link = parse(input);
  if (!link) throw new Error(`parse returned null for ${input}`);
  return link;
}

const identity = (l: ParsedLink) => ({ platform: l.platform, kind: l.kind, platformId: l.platformId, canonicalUrl: l.canonicalUrl });

describe.each(Object.entries(groups))("%s fixtures", (_name, fixtures) => {
  it.each(fixtures)("$from", (f) => {
    const link = mustParse(f.input);
    expect({ ...identity(link), author: link.author, needsResolve: link.needsResolve }).toEqual({
      platform: f.platform,
      kind: f.kind,
      platformId: f.platformId,
      canonicalUrl: f.canonicalUrl,
      author: f.author,
      needsResolve: f.needsResolve ?? false,
    });
  });
});

describe("invariants across every fixture", () => {
  it.each(all)("canonical URL parses back to itself: $from ($input)", (f) => {
    const link = mustParse(f.input);
    expect(identity(mustParse(link.canonicalUrl))).toEqual(identity(link));
  });

  it("has well-formed output for every fixture", () => {
    for (const f of all) {
      const link = mustParse(f.input);
      expect(PLATFORMS).toContain(link.platform);
      expect(KINDS).toContain(link.kind);
      expect(link.canonicalUrl).toMatch(/^https?:\/\/[^/]+/);
      expect(link.canonicalUrl.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
      expect(link.originalUrl).toMatch(/^https?:\/\//);
      expect(link.originalUrl.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
      expect(link.needsResolve).toBe(link.resolveVia !== undefined);
      // Embeds come only from ids we validated, and never for unresolved links.
      if (link.embed) {
        expect(link.embed.platform).toBe(link.platform);
        expect(link.platformId).not.toBeNull();
        expect(link.needsResolve).toBe(false);
      }
      if (link.author !== undefined) expect(link.author.length).toBeGreaterThan(0);
    }
  });

  it("covers every platform with at least 10 fixtures", () => {
    for (const platform of PLATFORMS) {
      expect(all.filter((f) => f.platform === platform).length, platform).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("refused input", () => {
  it.each(invalid.map((input) => [JSON.stringify(input.slice(0, 60)), input]))("%s → null", (_label, input) => {
    expect(parse(input)).toBeNull();
  });
});

describe("originalUrl", () => {
  it("keeps the link as shared, with the scheme added", () => {
    expect(mustParse("x.com/NASA/status/20?s=46").originalUrl).toBe("https://x.com/NASA/status/20?s=46");
  });
  it("keeps a redirect wrapper as shared while the canonical URL is its target", () => {
    const link = mustParse("https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2F&h=AT0");
    expect(link.originalUrl).toBe("https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2F&h=AT0");
    expect(link.canonicalUrl).toBe("https://example.com/");
  });
  it("falls back to the canonical URL when the shared one is too long to store", () => {
    const link = mustParse(`https://example.com/a?utm_content=${"x".repeat(2100)}`);
    expect(link.canonicalUrl).toBe("https://example.com/a");
    expect(link.originalUrl).toBe("https://example.com/a");
  });
});

describe("embeds", () => {
  const embedOf = (input: string) => mustParse(input).embed;

  it("builds one descriptor per platform from parsed ids", () => {
    expect(embedOf("https://www.instagram.com/reel/C8xYz12AbCd/")).toEqual({ platform: "instagram", code: "C8xYz12AbCd" });
    expect(embedOf("https://x.com/NASA/status/1812345678901234567")).toEqual({ platform: "x", id: "1812345678901234567" });
    expect(embedOf("https://www.tiktok.com/@scout2015/video/6718335390845095173")).toEqual({ platform: "tiktok", id: "6718335390845095173" });
    expect(embedOf("https://youtu.be/dQw4w9WgXcQ?t=43")).toEqual({ platform: "youtube", id: "dQw4w9WgXcQ", start: 43 });
    expect(embedOf("https://youtu.be/dQw4w9WgXcQ")).toEqual({ platform: "youtube", id: "dQw4w9WgXcQ" });
    expect(embedOf("https://www.reddit.com/r/AskReddit/comments/1abcd2e/comment/kxyz123/")).toEqual({
      platform: "reddit",
      postId: "1abcd2e",
      subreddit: "AskReddit",
      commentId: "kxyz123",
    });
    expect(embedOf("https://www.facebook.com/reel/1234567890123456")).toEqual({
      platform: "facebook",
      type: "video",
      href: "https://www.facebook.com/reel/1234567890123456",
    });
    expect(embedOf("https://www.facebook.com/zuck/posts/10115123456789012")).toEqual({
      platform: "facebook",
      type: "post",
      href: "https://www.facebook.com/zuck/posts/10115123456789012",
    });
    expect(embedOf("https://www.linkedin.com/feed/update/urn:li:ugcPost:7212345678901234567/")).toEqual({
      platform: "linkedin",
      urn: "urn:li:ugcPost:7212345678901234567",
    });
    expect(embedOf("https://www.threads.com/@zuck/post/C8AbCdEfGhI")).toEqual({ platform: "threads", code: "C8AbCdEfGhI", user: "zuck" });
    expect(embedOf("https://pin.it/4AbCdEfGh")).toBeNull();
    expect(embedOf("https://www.pinterest.com/pin/123456789012345678/")).toEqual({ platform: "pinterest", id: "123456789012345678" });
    expect(embedOf("https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3l6oveex3ii2l")).toEqual({
      platform: "bluesky",
      did: "did:plc:z72i7hdynmk6r22z27h6tvur",
      rkey: "3l6oveex3ii2l",
    });
  });

  it("shows a link card for profiles, stories, group posts, handles and other sites", () => {
    for (const input of [
      "https://www.instagram.com/natgeo/",
      "https://www.instagram.com/stories/natgeo/3412345678901234567/",
      "https://www.facebook.com/groups/123456789012345/posts/1234567890123456/",
      "https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l",
      "https://example.com/article",
    ]) {
      expect(embedOf(input), input).toBeNull();
    }
  });

  it("never lets markup or odd characters through into an embed", () => {
    expect(embedOf('https://www.instagram.com/p/"><script>/')).toBeNull();
    expect(embedOf("https://x.com/NASA/status/123abc")).toBeNull();
    expect(embedOf("https://www.youtube.com/watch?v=<img/src=x>")).toBeNull();
  });
});

describe("robustness", () => {
  // Deterministic pseudo-random generator, so a failure is reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pieces = [
    "https://", "http://", "www.", "instagram.com", "x.com", "youtu.be", "reddit.com", "facebook.com", "bsky.app",
    "/", "/p/", "/status/", "/r/", "/comments/", "/watch?v=", "?", "&", "=", "#", "%", "%3A", "@", ":", ".", "..",
    "a", "Z", "0", "1234567890", " ", "​", "é", "😀", "<", ">", '"', "'", "\\", "\n", "at://", "intent://",
  ];

  it("never throws on random input, and any result is storable and stable", () => {
    const next = rng(20260929);
    for (let i = 0; i < 5000; i++) {
      let s = "";
      const n = 1 + Math.floor(next() * 12);
      for (let j = 0; j < n; j++) s += pieces[Math.floor(next() * pieces.length)];
      const link = parse(s);
      if (!link) continue;
      expect(link.canonicalUrl, s).toMatch(/^https?:\/\//);
      expect(link.canonicalUrl.length, s).toBeLessThanOrEqual(MAX_URL_LENGTH);
      expect(identity(mustParse(link.canonicalUrl)), s).toEqual(identity(link));
    }
  });
});

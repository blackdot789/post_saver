import { describe, expect, it } from "vitest";
import { parse, saveId, sha256Hex } from "../src/index.ts";

async function idOf(input: string): Promise<string> {
  const link = parse(input);
  if (!link) throw new Error(`parse returned null for ${input}`);
  return saveId(link);
}

describe("sha256Hex", () => {
  it("matches the standard test vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("saveId", () => {
  it("uses platform + id when the post is identified", async () => {
    expect(await idOf("https://www.instagram.com/reel/C8xYz12AbCd/")).toBe("instagram_C8xYz12AbCd");
    expect(await idOf("https://www.reddit.com/r/AskReddit/comments/1abcd2e/comment/kxyz123/")).toBe("reddit_1abcd2e_kxyz123");
    expect(await idOf("https://www.linkedin.com/feed/update/urn:li:activity:7212345678901234567/")).toBe("linkedin_activity_7212345678901234567");
    expect(await idOf("https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3l6oveex3ii2l")).toBe(
      "bluesky_did:plc:z72i7hdynmk6r22z27h6tvur_3l6oveex3ii2l",
    );
  });

  it("hashes the canonical URL for other links and unresolved short links", async () => {
    const canonical = "https://example.com/article?id=42";
    const expected = `url_${(await sha256Hex(canonical)).slice(0, 24)}`;
    expect(await idOf("https://example.com/article?utm_source=x&id=42")).toBe(expected);
    expect(await idOf("https://vm.tiktok.com/ZMhvqjXXX/")).toMatch(/^url_[0-9a-f]{24}$/);
    expect(await idOf("https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l")).toMatch(/^url_[0-9a-f]{24}$/);
  });

  // The whole point: the same post shared from anywhere lands on the same document.
  it.each([
    [
      "Instagram",
      [
        "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==",
        "https://www.instagram.com/p/C8xYz12AbCd/?utm_source=ig_web_copy_link",
        "instagram.com/natgeo/reel/C8xYz12AbCd",
        "https://m.instagram.com/reels/C8xYz12AbCd/",
      ],
    ],
    [
      "X",
      [
        "https://x.com/NASA/status/1812345678901234567?s=46&t=abc",
        "https://twitter.com/NASA/status/1812345678901234567",
        "https://x.com/i/web/status/1812345678901234567",
        "https://fxtwitter.com/NASA/status/1812345678901234567/photo/1",
      ],
    ],
    [
      "YouTube",
      [
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      ],
    ],
    [
      "Reddit",
      [
        "https://www.reddit.com/r/AskReddit/comments/1abcd2e/slug/?utm_source=share",
        "https://old.reddit.com/r/AskReddit/comments/1abcd2e/",
        "https://redd.it/1abcd2e",
      ],
    ],
    [
      "LinkedIn",
      [
        "https://www.linkedin.com/posts/satyanadella_ai-activity-7212345678901234567-AbCd?utm_source=share",
        "https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7212345678901234567/",
      ],
    ],
    [
      "Any website",
      ["https://Example.com/a?utm_source=x#top", "example.com/a", "https://example.com/a?fbclid=abc"],
    ],
  ])("%s: every form gives one id", async (_name, inputs) => {
    const ids = new Set(await Promise.all(inputs.map(idOf)));
    expect(ids.size).toBe(1);
  });
});

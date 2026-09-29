import { describe, expect, it } from "vitest";
import { extractSharedUrl, findUrls, type SharedInput } from "../src/index.ts";

// What Android apps put in the Web Share Target params (title/text/url) when you tap Share.
const shares: Array<{ from: string; input: SharedInput; expected: string | null }> = [
  { from: "Instagram app (link only, in text)", input: { text: "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==" }, expected: "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==" },
  { from: "TikTok app (sentence before the link)", input: { text: "Check out @scout2015's video! #TikTok https://vm.tiktok.com/ZMhvqjXXX/" }, expected: "https://vm.tiktok.com/ZMhvqjXXX/" },
  { from: "YouTube app (title + link)", input: { title: "Rick Astley - Never Gonna Give You Up", text: "https://youtu.be/dQw4w9WgXcQ?si=AbCd" }, expected: "https://youtu.be/dQw4w9WgXcQ?si=AbCd" },
  { from: "X app", input: { text: "https://x.com/NASA/status/1812345678901234567?t=Ab12&s=19" }, expected: "https://x.com/NASA/status/1812345678901234567?t=Ab12&s=19" },
  { from: "Reddit app (title + link)", input: { title: "What's a skill everyone should learn?", text: "https://www.reddit.com/r/AskReddit/s/AbCdEf1234" }, expected: "https://www.reddit.com/r/AskReddit/s/AbCdEf1234" },
  { from: "Sentence ending in a colon", input: { text: "Check out this post on LinkedIn: https://www.linkedin.com/posts/satyanadella_ai-activity-7212345678901234567-AbCd?utm_source=share&utm_medium=member_android" }, expected: "https://www.linkedin.com/posts/satyanadella_ai-activity-7212345678901234567-AbCd?utm_source=share&utm_medium=member_android" },
  { from: "Sentence ending in !", input: { text: "Check out this Pin! https://pin.it/4AbCdEfGh" }, expected: "https://pin.it/4AbCdEfGh" },
  { from: "Chrome share (url + title)", input: { url: "https://example.com/article", title: "Great article" }, expected: "https://example.com/article" },
  { from: "url param wins over text", input: { url: "https://a.example/x", text: "see https://b.example/y" }, expected: "https://a.example/x" },
  { from: "text wins over title", input: { title: "https://c.example/z", text: "see https://b.example/y" }, expected: "https://b.example/y" },
  { from: "Chinese share text", input: { text: "看看这个视频：https://v.douyin.com/iAbCdEf/ 复制此链接，打开抖音搜索" }, expected: "https://v.douyin.com/iAbCdEf/" },
  { from: "Full-width comma right after the link", input: { text: "链接https://example.com/a，看看" }, expected: "https://example.com/a" },
  { from: "Link in parentheses, with parens inside", input: { text: "Look (https://en.wikipedia.org/wiki/Bond_(film)). Nice!" }, expected: "https://en.wikipedia.org/wiki/Bond_(film)" },
  { from: "Markdown link", input: { text: "[post](https://x.com/NASA/status/1812345678901234567)" }, expected: "https://x.com/NASA/status/1812345678901234567" },
  { from: "In quotes", input: { text: 'He said "https://example.com/q" today' }, expected: "https://example.com/q" },
  { from: "Emoji right after the link", input: { text: "https://example.com/a🔥🔥 so good" }, expected: "https://example.com/a" },
  { from: "Instagram code ending in _", input: { text: "https://www.instagram.com/p/C8xYz12AbC_" }, expected: "https://www.instagram.com/p/C8xYz12AbC_" },
  { from: "First of several links", input: { text: "https://one.example/a and https://two.example/b" }, expected: "https://one.example/a" },
  { from: "Link on its own line", input: { text: "Title here\nhttps://example.com/x\nmore text" }, expected: "https://example.com/x" },
  { from: "Known host typed without scheme", input: { text: "saw this instagram.com/p/C8xYz12AbCd lol" }, expected: "instagram.com/p/C8xYz12AbCd" },
  { from: "www link ending a sentence", input: { text: "go to www.example.com/page." }, expected: "www.example.com/page" },
  { from: "Scheme-less value in url param", input: { url: "example.com/page" }, expected: "example.com/page" },
  { from: "AT Protocol URI", input: { text: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l" }, expected: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l" },
  { from: "Title that only looks like a domain", input: { title: "Node.js" }, expected: null },
  { from: "No link at all", input: { text: "no links here", title: "Nothing" }, expected: null },
  { from: "Empty share", input: {}, expected: null },
];

describe("extractSharedUrl", () => {
  it.each(shares)("$from", ({ input, expected }) => {
    expect(extractSharedUrl(input)).toBe(expected);
  });
});

describe("findUrls (paste box)", () => {
  it("returns every link in order", () => {
    const pasted = [
      "https://www.instagram.com/p/C8xYz12AbCd/",
      "youtube.com/watch?v=dQw4w9WgXcQ and https://x.com/NASA/status/20",
      "not a link",
      "https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l",
    ].join("\n");
    expect(findUrls(pasted)).toEqual([
      "https://www.instagram.com/p/C8xYz12AbCd/",
      "youtube.com/watch?v=dQw4w9WgXcQ",
      "https://x.com/NASA/status/20",
      "https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l",
    ]);
  });
  it("respects the limit", () => {
    expect(findUrls("https://a.example/1 https://a.example/2 https://a.example/3", { limit: 2 })).toHaveLength(2);
  });
  it("accepts a lone host/path only when asked", () => {
    expect(findUrls("example.com/page")).toEqual([]);
    expect(findUrls("example.com/page", { lone: true })).toEqual(["example.com/page"]);
  });
});

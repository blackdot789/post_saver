import { describe, expect, it } from "vitest";
import { clip, decodeEntities, metaContent, metaRefresh, readStart, textOf, titleTag } from "../src/html.ts";
import { meta } from "../src/meta.ts";
import { fakeNet, html, jsonAnswer, redirect } from "./helpers.ts";

const enc = encodeURIComponent;

describe("meta", () => {
  it("YouTube: title, channel and the thumbnail whose address doesn't expire", async () => {
    const watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const net = fakeNet({
      [`https://www.youtube.com/oembed?url=${enc(watch)}&format=json`]: jsonAnswer({
        title: "Rick Astley - Never Gonna Give You Up (Official Video)",
        author_name: "Rick Astley",
        thumbnail_url: "https://evil.example/t.jpg",
      }),
    });
    expect(await meta("https://youtu.be/dQw4w9WgXcQ?si=abc", net.fetcher)).toEqual({
      ok: true,
      meta: { title: "Rick Astley - Never Gonna Give You Up (Official Video)", author: "Rick Astley", thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
    });
  });

  it("X: the post's text and the handle from the profile address", async () => {
    const post = "https://x.com/i/status/20";
    const net = fakeNet({
      [`https://publish.x.com/oembed?url=${enc(post)}&omit_script=1&dnt=1`]: jsonAnswer({
        author_name: "jack",
        author_url: "https://x.com/jack",
        html: `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr &amp; more<br>second line <a href="https://t.co/x">pic.x.com/abc</a></p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20">March 21, 2006</a></blockquote>`,
      }),
    });
    expect(await meta(post, net.fetcher)).toEqual({ ok: true, meta: { title: "just setting up my twttr & more second line pic.x.com/abc", author: "jack" } });
  });

  it("Reddit: the title is the first link of the blockquote", async () => {
    const post = "https://www.reddit.com/r/pics/comments/92dd8/";
    const net = fakeNet({
      [`https://www.reddit.com/oembed?url=${enc(post)}`]: jsonAnswer({
        author_name: "qgyh2",
        html: `<blockquote class="reddit-embed-bq">\n<a href="https://www.reddit.com/r/pics/comments/92dd8/test_post_please_ignore/">test post please ignore</a><br> by\n<a href="https://www.reddit.com/user/qgyh2/">u/qgyh2</a></blockquote>`,
      }),
    });
    expect(await meta("https://www.reddit.com/r/pics/comments/92dd8/test_post_please_ignore/", net.fetcher)).toEqual({ ok: true, meta: { title: "test post please ignore", author: "qgyh2" } });
  });

  it("TikTok, Pinterest and Bluesky", async () => {
    const video = "https://www.tiktok.com/@scout2015/video/6718335390845095173";
    const pin = "https://www.pinterest.com/pin/99360735500167749/";
    const uri = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3mwolmfws5k2r";
    const net = fakeNet({
      [`https://www.tiktok.com/oembed?url=${enc(video)}`]: jsonAnswer({ title: "Scramble up ur name & I'll try to guess it😍❤️", author_name: "Scout, Suki & Stella", author_unique_id: "scout2015" }),
      [`https://www.pinterest.com/oembed.json?url=${enc(pin)}`]: jsonAnswer({ title: "Love my Pinterest t-shirt!", author_name: "Kent Brewster", thumbnail_url: "https://i.pinimg.com/236x/a.jpg" }),
      [`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${enc(uri)}`]: jsonAnswer({ posts: [{ record: { text: "Happy opening day\nof hockey season" }, author: { handle: "bsky.app" } }] }),
    });
    expect(await meta(video, net.fetcher)).toEqual({ ok: true, meta: { title: "Scramble up ur name & I'll try to guess it😍❤️", author: "scout2015" } });
    // Pinterest's image addresses expire, so no thumbnail is kept.
    expect(await meta(pin, net.fetcher)).toEqual({ ok: true, meta: { title: "Love my Pinterest t-shirt!", author: "Kent Brewster" } });
    expect(await meta("https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3mwolmfws5k2r", net.fetcher)).toEqual({
      ok: true,
      meta: { title: "Happy opening day of hockey season", author: "bsky.app" },
    });
  });

  it("any other site: og: tags first, then <title>, following its redirects", async () => {
    const net = fakeNet({
      "https://example.com/article": redirect("/news/article/"),
      "https://example.com/news/article/": html(
        `<!doctype html><html><head><meta charset="utf-8"><title>Fallback title | Example</title>
         <meta content="An article &amp; its &#8220;title&#8221;" property="og:title">
         <meta name='author' content='Ada Lovelace'><meta property="og:site_name" content="Example News"></head><body>…</body></html>`,
      ),
      "https://plain.example/page": html("<html><head><title>\n  Just a &lt;title&gt;  </title></head></html>"),
      "https://files.example/report.pdf": new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } }),
    });
    expect(await meta("https://example.com/article?utm_source=x", net.fetcher)).toEqual({ ok: true, meta: { title: "An article & its “title”", author: "Ada Lovelace" } });
    expect(await meta("https://plain.example/page", net.fetcher)).toEqual({ ok: true, meta: { title: "Just a <title>" } });
    expect(await meta("https://files.example/report.pdf", net.fetcher)).toEqual({ ok: true, meta: {} });
  });

  it("sites with an open oEmbed endpoint use it (Spotify)", async () => {
    const track = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
    const net = fakeNet({ [`https://open.spotify.com/oembed?url=${enc(track)}`]: jsonAnswer({ title: "Never Gonna Give You Up" }) });
    expect(await meta(track, net.fetcher)).toEqual({ ok: true, meta: { title: "Never Gonna Give You Up" } });
    expect(net.calls).toHaveLength(1);
  });

  it("asks nothing of platforms that tell nothing without a login, and of pages that aren't posts", async () => {
    const net = fakeNet({});
    for (const url of [
      "https://www.instagram.com/reel/C8xYz12AbCd/",
      "https://www.facebook.com/NASA/posts/162061523837685/",
      "https://www.threads.com/@zuck/post/CuP48CiS5sx",
      "https://www.linkedin.com/feed/update/urn:li:activity:7168922878233489408/",
      "https://www.youtube.com/feed/trending",
    ]) {
      expect(await meta(url, net.fetcher)).toEqual({ ok: true, meta: {} });
    }
    expect(net.calls).toEqual([]);
  });

  it("refuses a short link (it's described once resolved) and anything that isn't a link", async () => {
    const net = fakeNet({});
    expect(await meta("https://vm.tiktok.com/ZMhvqjXXX/", net.fetcher)).toMatchObject({ ok: false, error: "bad_url" });
    expect(await meta("not a link", net.fetcher)).toMatchObject({ ok: false, error: "bad_url" });
    expect(net.calls).toEqual([]);
  });

  it("a post that's gone is 'nothing to add'; a platform that's down is worth another try", async () => {
    const post = "https://x.com/i/status/20";
    const endpoint = `https://publish.x.com/oembed?url=${enc(post)}&omit_script=1&dnt=1`;
    expect(await meta(post, fakeNet({ [endpoint]: jsonAnswer({ error: "Not found" }, 404) }).fetcher)).toEqual({ ok: true, meta: {} });
    expect(await meta(post, fakeNet({ [endpoint]: jsonAnswer({}, 503) }).fetcher)).toEqual({ ok: false, error: "upstream", reason: "platform answered 503" });
    expect(await meta(post, fakeNet({ [endpoint]: jsonAnswer({}, 403) }).fetcher)).toEqual({ ok: false, error: "upstream", reason: "platform answered 403" });
    expect(await meta(post, fakeNet({ [endpoint]: new Error("timeout") }).fetcher)).toEqual({ ok: false, error: "upstream", reason: "no answer" });
    expect(await meta("https://example.com/down", fakeNet({ "https://example.com/down": new Response("", { status: 502 }) }).fetcher)).toMatchObject({ ok: false, error: "upstream" });
  });

  it("never follows a page's redirect to a private address or a sign-in wall", async () => {
    const net = fakeNet({
      "https://example.com/a": redirect("http://169.254.169.254/latest/"),
      "https://example.com/b": redirect("https://example.com/login?next=/b"),
    });
    expect(await meta("https://example.com/a", net.fetcher)).toEqual({ ok: true, meta: {} });
    expect(await meta("https://example.com/b", net.fetcher)).toEqual({ ok: true, meta: {} });
    expect(net.calls).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("cuts long titles on a word and keeps authors short", async () => {
    const long = `${"word ".repeat(100)}end`;
    const net = fakeNet({ "https://example.com/long": html(`<head><meta property="og:title" content="${long}"><meta name="author" content="${"A".repeat(150)}"></head>`) });
    const result = await meta("https://example.com/long", net.fetcher);
    if (!result.ok) throw new Error("expected a result");
    expect(result.meta.title?.length).toBeLessThanOrEqual(300);
    expect(result.meta.title?.endsWith("word…")).toBe(true);
    expect(Array.from(result.meta.author ?? "").length).toBe(100);
  });
});

describe("html helpers", () => {
  it("decodes entities and strips tags", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#39;d&#x27; &quot;e&quot;&nbsp;&hellip; &unknown;")).toBe(`a & b <c> 'd' "e" … &unknown;`);
    // Code points that aren't characters are dropped.
    expect(decodeEntities("[&#0;&#xD800;&#x110000;]")).toBe("[]");
    expect(textOf("<p>one<br>two</p>\n<b>three</b>")).toBe("one two three");
  });

  it("clips by characters, not bytes", () => {
    expect(clip("  hello   world  ", 50)).toBe("hello world");
    expect(clip("😀".repeat(10), 5)).toBe(`${"😀".repeat(4)}…`);
  });

  it("finds meta tags whatever the attribute order or quotes", () => {
    const head = `<META NAME=description CONTENT=plain><meta content='single' property='og:title'><meta property="og:title" content="second"><meta name="twitter:title" content="tw">`;
    expect(metaContent(head, ["og:title", "twitter:title"])).toBe("single");
    expect(metaContent(head, ["twitter:title", "og:title"])).toBe("tw");
    expect(metaContent(head, ["description"])).toBe("plain");
    expect(metaContent(head, ["og:image"])).toBeUndefined();
    expect(titleTag("<title lang=en>A <b>B</b></title>")).toBe("A B");
    expect(titleTag("<p>no title</p>")).toBeUndefined();
  });

  it("reads a meta refresh", () => {
    expect(metaRefresh(`<meta http-equiv="refresh" content="0; url='https://example.com/x'">`)).toBe("https://example.com/x");
    expect(metaRefresh(`<meta http-equiv="Refresh" content="5;URL=/next">`)).toBe("/next");
    expect(metaRefresh(`<meta http-equiv="refresh" content="30">`)).toBeUndefined();
  });

  it("stops downloading a page at the end of <head>, and at the byte limit", async () => {
    let pulled = 0;
    const chunks = ["<html><head><title>T</title>", "</head><body>", "x".repeat(1000), "y".repeat(1000)];
    const stream = (limit = chunks.length) =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (pulled < limit) controller.enqueue(new TextEncoder().encode(chunks[pulled++]!));
            else controller.close();
          },
        }),
        { headers: { "content-type": "text/html" } },
      );
    const head = await readStart(stream(), 1_000_000, true);
    expect(head).toBe("<html><head><title>T</title></head><body>");
    expect(pulled).toBeLessThanOrEqual(3);

    pulled = 0;
    const capped = await readStart(stream(), 30);
    expect(capped.length).toBeLessThan(60);
  });
});

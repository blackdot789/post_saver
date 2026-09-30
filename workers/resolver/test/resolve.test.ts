import { describe, expect, it } from "vitest";
import { BudgetError } from "../src/fetcher.ts";
import { MAX_HOPS, resolve } from "../src/resolve.ts";
import { fakeNet, html, redirect } from "./helpers.ts";

const VIDEO = "https://www.tiktok.com/@scout2015/video/6718335390845095173";

describe("resolve", () => {
  it.each([
    ["a post that needs no resolving", "https://www.instagram.com/p/C8xYz12AbCd/"],
    ["any other site", "https://example.com/some/page"],
    ["not a link", "javascript:alert(1)"],
    ["an IP address", "https://192.168.1.1/admin"],
  ])("refuses %s without fetching anything", async (_label, url) => {
    const net = fakeNet({});
    expect(await resolve(url, net.fetcher)).toMatchObject({ ok: false, error: "bad_url" });
    expect(net.calls).toEqual([]);
  });

  it("follows a platform short link to the post, and never fetches the post itself", async () => {
    const net = fakeNet({ "https://vm.tiktok.com/ZMhvqjXXX/": redirect(`${VIDEO}?is_from_webapp=1&sender_device=pc`) });
    expect(await resolve("https://vm.tiktok.com/ZMhvqjXXX/", net.fetcher)).toEqual({ ok: true, finalUrl: `${VIDEO}?is_from_webapp=1&sender_device=pc` });
    expect(net.calls).toEqual(["https://vm.tiktok.com/ZMhvqjXXX/"]);
  });

  it("follows relative redirects and a chain of shorteners", async () => {
    const net = fakeNet({
      "https://bit.ly/3abcDEF": redirect("https://t.co/AbCdEf1234", 302),
      "https://t.co/AbCdEf1234": redirect("https://example.com/article?utm_source=x"),
    });
    expect(await resolve("https://bit.ly/3abcDEF", net.fetcher)).toEqual({ ok: true, finalUrl: "https://example.com/article?utm_source=x" });

    const relative = fakeNet({ "https://www.instagram.com/share/reel/BAbc123xyz": redirect("/reel/C8xYz12AbCd/?igsh=abc", 302) });
    expect(await resolve("https://www.instagram.com/share/reel/BAbc123xyz", relative.fetcher)).toEqual({
      ok: true,
      finalUrl: "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc",
    });
  });

  it("passes through Pinterest's redirect service on the way to the Pin", async () => {
    const net = fakeNet({
      "https://pin.it/4AbCdEfGh": redirect("https://api.pinterest.com/url_shortener/4AbCdEfGh/redirect/", 302),
      "https://api.pinterest.com/url_shortener/4AbCdEfGh/redirect/": redirect("https://www.pinterest.com/pin/99360735500167749/sent/?invite_code=abc", 302),
    });
    expect(await resolve("https://pin.it/4AbCdEfGh", net.fetcher)).toEqual({ ok: true, finalUrl: "https://www.pinterest.com/pin/99360735500167749/sent/?invite_code=abc" });
  });

  it("reads a redirect written into the page (t.co answers browsers that way)", async () => {
    const page = `<head><noscript><META http-equiv="refresh" content="0;URL=https://example.com/story?a=1&amp;b=2"></noscript><title>https://example.com/story</title></head>`;
    const net = fakeNet({ "https://t.co/AbCdEf1234": html(page) });
    expect(await resolve("https://t.co/AbCdEf1234", net.fetcher)).toEqual({ ok: true, finalUrl: "https://example.com/story?a=1&b=2" });
  });

  it("reads the destination from LinkedIn's 'leaving LinkedIn' page", async () => {
    const page = `<main><a class="artdeco-button" data-tracking-control-name="external_url_click" data-tracking-will-navigate href="https://example.com/report?x=1&amp;y=2">Continue</a></main>`;
    const net = fakeNet({ "https://lnkd.in/gAbCdEfG": html(page) });
    expect(await resolve("https://lnkd.in/gAbCdEfG", net.fetcher)).toEqual({ ok: true, finalUrl: "https://example.com/report?x=1&y=2" });
  });

  it.each([
    ["Instagram's sign-in page", "https://www.instagram.com/accounts/login/?next=%2Freel%2FC8xYz12AbCd%2F", "sign-in wall"],
    ["Facebook's sign-in page", "https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Fwatch", "sign-in wall"],
    ["LinkedIn's wall", "https://www.linkedin.com/authwall?trk=bf&sessionRedirect=x", "sign-in wall"],
    ["an IP address", "https://169.254.169.254/latest/meta-data/", "unsafe redirect"],
    ["another port", "https://example.com:8443/x", "unsafe redirect"],
    ["a private name", "https://router.local/admin", "unsafe redirect"],
    ["another scheme", "ftp://example.com/file", "unsafe redirect"],
  ])("gives up on a redirect to %s", async (_label, to, reason) => {
    const net = fakeNet({ "https://fb.watch/abc123XYZ/": redirect(to, 302) });
    expect(await resolve("https://fb.watch/abc123XYZ/", net.fetcher)).toEqual({ ok: false, error: "unresolved", reason });
    expect(net.calls).toHaveLength(1);
  });

  it("a platform's short link that ends on its home page isn't a result; a generic shortener may point anywhere", async () => {
    const net = fakeNet({
      "https://pin.it/1abcDEF": redirect("https://www.pinterest.com/", 302),
      "https://fb.watch/abc123XYZ/": redirect("https://www.facebook.com/watch/", 302),
      "https://bit.ly/3abcDEF": redirect("https://www.pinterest.com/", 302),
      "https://www.instagram.com/share/BAbc123xyz": redirect("https://www.instagram.com/natgeo/", 302),
    });
    expect(await resolve("https://pin.it/1abcDEF", net.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "not a post" });
    expect(await resolve("https://fb.watch/abc123XYZ/", net.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "not a post" });
    expect(await resolve("https://bit.ly/3abcDEF", net.fetcher)).toEqual({ ok: true, finalUrl: "https://www.pinterest.com/" });
    // A shared profile is a fine result.
    expect(await resolve("https://www.instagram.com/share/BAbc123xyz", net.fetcher)).toEqual({ ok: true, finalUrl: "https://www.instagram.com/natgeo/" });
  });

  it("stops after the hop limit", async () => {
    const net = fakeNet({
      "https://bit.ly/loopA": redirect("https://bit.ly/loopB"),
      "https://bit.ly/loopB": redirect("https://bit.ly/loopA"),
    });
    expect(await resolve("https://bit.ly/loopA", net.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "too many hops" });
    expect(net.calls).toHaveLength(MAX_HOPS);
  });

  it("reports a short link that doesn't redirect, or a site that doesn't answer", async () => {
    const plain = fakeNet({ "https://bit.ly/3abcDEF": html("<title>Expired</title>") });
    expect(await resolve("https://bit.ly/3abcDEF", plain.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "no redirect (200)" });
    const gone = fakeNet({});
    expect(await resolve("https://bit.ly/3abcDEF", gone.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "no redirect (404)" });
    const down = fakeNet({ "https://bit.ly/3abcDEF": new Error("timeout") });
    expect(await resolve("https://bit.ly/3abcDEF", down.fetcher)).toEqual({ ok: false, error: "unresolved", reason: "no answer" });
  });

  it("stops when the call has used up its outgoing requests", async () => {
    const net = fakeNet({ "https://bit.ly/loopA": redirect("https://bit.ly/loopB"), "https://bit.ly/loopB": redirect("https://bit.ly/loopA") }, 2);
    await expect(resolve("https://bit.ly/loopA", net.fetcher)).rejects.toBeInstanceOf(BudgetError);
    expect(net.calls).toHaveLength(2);
  });
});

import { origins } from "@postsaver/config";
import { MAX_BATCH, type BatchResult } from "@postsaver/core";
import { describe, expect, it } from "vitest";
import { createHandler } from "../src/handler.ts";
import { fakeNet, jsonAnswer, redirect } from "./helpers.ts";

const BASE = "https://worker.example";
const VERIFIED = "verified-token";
const UNVERIFIED = "unverified-token";

const verify = async (token: string) => (token === VERIFIED ? { uid: "u1", emailVerified: true } : token === UNVERIFIED ? { uid: "u2", emailVerified: false } : null);

function worker(routes: Parameters<typeof fakeNet>[0] = {}) {
  const net = fakeNet(routes);
  const handle = createHandler({ fetch: net.fetch, verify });
  const call = (path: string, init: RequestInit & { token?: string | null; origin?: string } = {}) => {
    const { token = VERIFIED, origin, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (origin) headers.set("Origin", origin);
    return handle(new Request(BASE + path, { ...rest, headers }));
  };
  return { call, calls: net.calls };
}

const batch = (items: unknown) => ({ method: "POST", body: JSON.stringify({ items }), headers: { "Content-Type": "application/json" } });

describe("the Worker", () => {
  it("answers /health to anyone", async () => {
    const res = await worker().call("/health", { token: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "resolver", phase: 1 });
  });

  it("sends CORS headers only to the app's own origins", async () => {
    const { call } = worker();
    const ours = await call("/health", { origin: origins.app });
    expect(ours.headers.get("Access-Control-Allow-Origin")).toBe(origins.app);
    const preflight = await call("/resolve", { method: "OPTIONS", origin: origins.app, token: null });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    const theirs = await call("/health", { origin: "https://evil.example" });
    expect(theirs.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("needs a signed-in caller with a verified email, before anything is fetched", async () => {
    const { call, calls } = worker({ "https://bit.ly/3abcDEF": redirect("https://example.com/") });
    const path = `/resolve?url=${encodeURIComponent("https://bit.ly/3abcDEF")}`;
    expect((await call(path, { token: null })).status).toBe(401);
    expect((await call(path, { token: "garbage" })).status).toBe(401);
    const unverified = await call(path, { token: UNVERIFIED });
    expect(unverified.status).toBe(403);
    expect(await unverified.json()).toEqual({ error: "email_not_verified" });
    expect(calls).toEqual([]);
  });

  it("knows only its three routes", async () => {
    const { call } = worker();
    expect((await call("/")).status).toBe(404);
    expect((await call("/resolve", { method: "POST" })).status).toBe(404);
    expect((await call("/batch")).status).toBe(404);
  });

  it("/resolve: the final address, which the caller's browser may keep for a week", async () => {
    const { call } = worker({ "https://bit.ly/3abcDEF": redirect("https://example.com/story") });
    const ok = await call(`/resolve?url=${encodeURIComponent("https://bit.ly/3abcDEF")}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ finalUrl: "https://example.com/story" });
    expect(ok.headers.get("Cache-Control")).toBe("private, max-age=604800");

    expect((await call("/resolve")).status).toBe(400);
    const notShort = await call(`/resolve?url=${encodeURIComponent("https://example.com/")}`);
    expect(notShort.status).toBe(400);
    expect(await notShort.json()).toEqual({ error: "bad_url" });
    const dead = await call(`/resolve?url=${encodeURIComponent("https://bit.ly/deadLink")}`);
    expect(dead.status).toBe(502);
    expect(await dead.json()).toEqual({ error: "unresolved" });
    expect(dead.headers.get("Cache-Control")).toBe("no-store");
  });

  it("/meta: the title, kept for a day", async () => {
    const watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const { call } = worker({ [`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`]: jsonAnswer({ title: "Never Gonna Give You Up", author_name: "Rick Astley" }) });
    const res = await call(`/meta?url=${encodeURIComponent(watch)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: "Never Gonna Give You Up", author: "Rick Astley", thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
  });

  it("/batch: one answer per item, in order, each saying whether a retry makes sense", async () => {
    const watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const { call } = worker({
      "https://bit.ly/3abcDEF": redirect("https://example.com/story"),
      [`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`]: jsonAnswer({ title: "Never Gonna Give You Up" }),
    });
    const res = await call(
      "/batch",
      batch([
        { url: "https://bit.ly/3abcDEF", do: "resolve" },
        { url: watch, do: "meta" },
        { url: "https://bit.ly/deadLink", do: "resolve" },
        { url: "https://example.com/", do: "resolve" },
        { url: "https://www.instagram.com/reel/C8xYz12AbCd/", do: "meta" },
      ]),
    );
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as { results: BatchResult[] };
    expect(results).toEqual([
      { url: "https://bit.ly/3abcDEF", do: "resolve", ok: true, finalUrl: "https://example.com/story" },
      { url: watch, do: "meta", ok: true, meta: { title: "Never Gonna Give You Up", thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } },
      { url: "https://bit.ly/deadLink", do: "resolve", ok: false, error: "unresolved", retry: true },
      { url: "https://example.com/", do: "resolve", ok: false, error: "bad_url", retry: false },
      { url: "https://www.instagram.com/reel/C8xYz12AbCd/", do: "meta", ok: true, meta: {} },
    ]);
  });

  it("/batch refuses a body that isn't 1 to 40 well-formed items", async () => {
    const { call } = worker();
    const item = { url: "https://example.com/", do: "meta" };
    expect((await call("/batch", batch([]))).status).toBe(400);
    expect((await call("/batch", batch(Array(MAX_BATCH + 1).fill(item)))).status).toBe(400);
    expect((await call("/batch", batch([{ url: "https://example.com/", do: "delete" }]))).status).toBe(400);
    expect((await call("/batch", batch([{ do: "meta" }]))).status).toBe(400);
    expect((await call("/batch", { method: "POST", body: "not json" })).status).toBe(400);
  });

  it("/batch stops fetching when the call runs out of outgoing requests, and says 'busy' for the rest", async () => {
    // 40 pages that each redirect three times: far more than one call may fetch.
    const routes: Record<string, Response> = {};
    const items = Array.from({ length: MAX_BATCH }, (_, i) => {
      routes[`https://site${i}.example/a`] = redirect(`https://site${i}.example/b`);
      routes[`https://site${i}.example/b`] = redirect(`https://site${i}.example/c`);
      routes[`https://site${i}.example/c`] = new Response("<title>ok</title>", { headers: { "content-type": "text/html" } });
      return { url: `https://site${i}.example/a`, do: "meta" };
    });
    const { call, calls } = worker(routes);
    const { results } = (await (await call("/batch", batch(items))).json()) as { results: BatchResult[] };
    expect(calls.length).toBe(45);
    expect(results.filter((r) => r.ok)).toHaveLength(15);
    expect(results.at(-1)).toEqual({ url: "https://site39.example/a", do: "meta", ok: false, error: "busy", retry: true });
  });
});

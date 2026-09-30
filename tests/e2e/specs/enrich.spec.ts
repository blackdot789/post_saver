import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse, saveId, type BatchItem, type BatchResult } from "@postsaver/core";
import { createUser, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, stubWorker, test } from "./fixtures.ts";

// The enrichment queue (CLAUDE.md §6.3): titles for saved posts, and short links turned into
// the posts they lead to. The Worker itself is tested in workers/resolver; here it's a stub.

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const YT_ID = "youtube_dQw4w9WgXcQ";
const SHORT = "https://vm.tiktok.com/ZMhvqjXXX/";
const VIDEO = "https://www.tiktok.com/@scout2015/video/6718335390845095173";
const VIDEO_ID = "tiktok_6718335390845095173";
const YT_META = { title: "Never Gonna Give You Up", author: "Rick Astley", thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" };

/** A verified account with previews "only when I tap", so no platform is contacted. */
async function account(request: APIRequestContext) {
  const email = uniqueEmail("enrich");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, { email, createdAt: new Date(), updatedAt: new Date(), settings: { previews: "click" }, schemaVersion: 1 });
  return { email, uid };
}

async function seed(request: APIRequestContext, uid: string, url: string, extra: Record<string, unknown> = {}): Promise<string> {
  const link = parse(url);
  if (!link) throw new Error(`parse failed for ${url}`);
  const id = await saveId(link);
  await writeDoc(request, `users/${uid}/saves/${id}`, { ...newSave(link, { source: "share-android", now: new Date(2026, 8, 1) }), ...extra });
  return id;
}

async function open(page: Page, email: string) {
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByRole("list", { name: "Saves" })).toBeVisible();
}

const card = (page: Page, id: string) => page.locator(`[data-save-id="${id}"]`);
const save = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);

/** Answers like the Worker would for the two links these tests use. */
function answers(items: BatchItem[]): BatchResult[] {
  return items.map((item): BatchResult => {
    if (item.do === "resolve") return { url: item.url, do: "resolve", ok: true, finalUrl: `${VIDEO}?is_from_webapp=1&sender_device=pc` };
    return { url: item.url, do: "meta", ok: true, meta: item.url === YT ? YT_META : { title: "Scramble up ur name", author: "scout2015" } };
  });
}

test("a saved video gets its title, channel and thumbnail, asked for with the user's sign-in", async ({ page, request, context }) => {
  const calls: Array<{ items: BatchItem[]; auth: string | null }> = [];
  await stubWorker(context, (items, req) => {
    calls.push({ items, auth: req.headers().authorization ?? null });
    return answers(items);
  });
  const { email, uid } = await account(request);
  await seed(request, uid, YT);
  await open(page, email);

  await expect(card(page, YT_ID)).toContainText("Never Gonna Give You Up");
  await expect(card(page, YT_ID)).toContainText("Rick Astley");
  await expect.poll(() => save(request, uid, YT_ID)).toMatchObject({ ...YT_META, needsMeta: false });
  expect(calls[0]?.items).toEqual([{ url: YT, do: "meta" }]);
  expect(calls[0]?.auth).toMatch(/^Bearer .+\..+\./);
  // Settled: nothing is asked again.
  await page.reload();
  await expect(card(page, YT_ID)).toContainText("Never Gonna Give You Up");
  await page.waitForTimeout(2500);
  expect(calls).toHaveLength(1);
  // The title is searchable.
  await page.getByRole("searchbox").fill("gonna give");
  await expect(page.locator("[data-save-id]")).toHaveCount(1);
});

test("a short link becomes the post it leads to, keeping its tags, note, favorite and date", async ({ page, request, context }) => {
  await stubWorker(context, answers);
  const { email, uid } = await account(request);
  const shortId = await seed(request, uid, SHORT, { tags: ["dance"], note: "Show the kids", favorite: true });
  expect(shortId).toMatch(/^url_/);
  await open(page, email);

  await expect(card(page, VIDEO_ID)).toBeVisible();
  await expect(card(page, shortId)).toHaveCount(0);
  await expect.poll(() => save(request, uid, shortId)).toMatchObject({ deleted: true });
  const post = await save(request, uid, VIDEO_ID);
  expect(post).toMatchObject({
    url: VIDEO,
    // The link as it was shared stays on record.
    originalUrl: SHORT,
    platform: "tiktok",
    platformId: "6718335390845095173",
    author: "scout2015",
    tags: ["dance"],
    note: "Show the kids",
    favorite: true,
    source: "share-android",
    needsResolve: false,
  });
  expect(String(post?.savedAt)).toMatch(/^2026-0[89]-/);
  // Then the post gets its title like any other.
  await expect.poll(() => save(request, uid, VIDEO_ID)).toMatchObject({ title: "Scramble up ur name", needsMeta: false });
  await expect(card(page, VIDEO_ID)).toContainText("Scramble up ur name");
});

test("a short link to a post that's saved already is folded into it", async ({ page, request, context }) => {
  await stubWorker(context, answers);
  const { email, uid } = await account(request);
  await seed(request, uid, VIDEO, { tags: ["funny"], note: "The original note", needsMeta: false });
  const shortId = await seed(request, uid, SHORT, { tags: ["dance", "funny"], note: "Another note", favorite: true });
  await open(page, email);

  await expect.poll(() => save(request, uid, shortId)).toMatchObject({ deleted: true });
  await expect(page.locator("[data-save-id]")).toHaveCount(1);
  expect(await save(request, uid, VIDEO_ID)).toMatchObject({ tags: ["funny", "dance"], note: "The original note", favorite: true, originalUrl: VIDEO });
});

test("a lookup that fails waits before the next try instead of looping", async ({ page, request, context }) => {
  let calls = 0;
  await stubWorker(context, (items) => {
    calls++;
    return items.map((item): BatchResult => ({ url: item.url, do: item.do, ok: false, error: "upstream", retry: true }));
  });
  const { email, uid } = await account(request);
  await seed(request, uid, YT);
  await open(page, email);

  await expect.poll(() => calls).toBe(1);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}")?.youtube_dQw4w9WgXcQ?.tries, `ps:enrich:${uid}`)).toBe(1);
  await page.reload();
  await expect(card(page, YT_ID)).toBeVisible();
  await page.waitForTimeout(2500);
  expect(calls).toBe(1);
  expect(await save(request, uid, YT_ID)).toMatchObject({ needsMeta: true });
});

test("a Bluesky handle is looked up by the browser, and the save keeps the account's permanent id", async ({ page, request, context }) => {
  await stubWorker(context, (items) => items.map((item): BatchResult => ({ url: item.url, do: "meta", ok: true, meta: { title: "Happy opening day" } })));
  let asked = "";
  await context.route("https://public.api.bsky.app/**", (route) => {
    asked = new URL(route.request().url()).searchParams.get("handle") ?? "";
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, json: { did: "did:plc:z72i7hdynmk6r22z27h6tvur" } });
  });
  const { email, uid } = await account(request);
  const handleId = await seed(request, uid, "https://bsky.app/profile/bsky.app/post/3mwolmfws5k2r");
  await open(page, email);

  const id = "bluesky_did:plc:z72i7hdynmk6r22z27h6tvur_3mwolmfws5k2r";
  await expect.poll(() => save(request, uid, id)).toMatchObject({ url: "https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3mwolmfws5k2r", needsResolve: false });
  expect(asked).toBe("bsky.app");
  expect(await save(request, uid, handleId)).toMatchObject({ deleted: true });
});

test("the save page looks up the title right after saving", async ({ page, request, context }) => {
  await stubWorker(context, answers);
  const { email, uid } = await account(request);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await page.goto(`/save/?${new URLSearchParams({ url: YT })}`);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect.poll(() => save(request, uid, YT_ID)).toMatchObject({ title: "Never Gonna Give You Up", needsMeta: false });
});

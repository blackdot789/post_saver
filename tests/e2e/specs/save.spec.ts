import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse } from "@postsaver/core";
import { PASSWORD, createUser, emailLink, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test, watchCsp } from "./fixtures.ts";

// Saving posts: /save/ and /share/ (the Android share target), CLAUDE.md §6.1 and §11.

// What Instagram's Android app puts in the share's `text`.
const IG_SHARE = "Check out this reel! https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==";
const IG_ID = "instagram_C8xYz12AbCd";
const IG_URL = "https://www.instagram.com/reel/C8xYz12AbCd/";

const share = (params: Record<string, string>) => `/share/?${new URLSearchParams(params)}`;
const save = (params: Record<string, string>) => `/save/?${new URLSearchParams(params)}`;
const saveDoc = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);

/** A verified account, signed in on this page. */
async function signedIn(page: Page, request: APIRequestContext) {
  const email = uniqueEmail("save");
  const uid = await createUser(request, email, true);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  return { email, uid };
}

test("a shared post is saved under its canonical id, and sharing it again says it's already saved", async ({ page, request }) => {
  const { uid } = await signedIn(page, request);
  await page.goto(share({ text: IG_SHARE }));
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  await expect(page.getByText("Instagram reel")).toBeVisible();
  // The shared link leaves the address bar, so a reload doesn't save it again.
  await expect(page).toHaveURL(/\/share\/$/);
  expect(await saveDoc(request, uid, IG_ID)).toMatchObject({
    url: IG_URL,
    originalUrl: "https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==",
    platform: "instagram",
    kind: "reel",
    source: "share-android",
    status: "active",
  });

  // The same post, shared in another form.
  await page.goto(share({ url: "instagram.com/reel/C8xYz12AbCd" }));
  await expect(page.getByRole("heading", { name: "Already saved" })).toBeVisible();
  await expect(page.getByText(/You saved this on /)).toBeVisible();
  const before = await saveDoc(request, uid, IG_ID);
  await page.getByRole("button", { name: "Move to top" }).click();
  await expect(page.getByText("Moved to the top of your library.")).toBeVisible();
  await expect.poll(async () => (await saveDoc(request, uid, IG_ID))?.savedAt).not.toBe(before?.savedAt);
});

test("tags and a note added right after saving are stored with the post", async ({ page, request }) => {
  const { uid } = await signedIn(page, request);
  await page.goto(save({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=AbCdEf" }));
  await expect(page.getByText("Synced to your library.")).toBeVisible();

  await page.getByLabel("Tags", { exact: true }).fill("Music, #Classics");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove tag music" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove tag classics" })).toBeVisible();

  await page.getByLabel("Note").fill("For the party playlist");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();

  await expect
    .poll(() => saveDoc(request, uid, "youtube_dQw4w9WgXcQ"))
    .toMatchObject({ source: "web", tags: ["music", "classics"], note: "For the party playlist" });

  await page.getByRole("button", { name: "Remove tag music" }).click();
  await expect.poll(async () => (await saveDoc(request, uid, "youtube_dQw4w9WgXcQ"))?.tags).toEqual(["classics"]);
});

test("a save on one device shows up live on another, which sees it as already saved", async ({ page, browser, request }) => {
  const { email } = await signedIn(page, request);
  await expect(page.getByText("Nothing saved yet")).toBeVisible();

  const phoneContext = await browser.newContext();
  const phone = await phoneContext.newPage();
  const phoneCsp = watchCsp(phone);
  await phone.goto("/login/");
  await signIn(phone, email);
  await expect(phone).toHaveURL(/\/app\/$/);
  await phone.goto(share({ text: IG_SHARE }));
  await expect(phone.getByText("Synced to your library.")).toBeVisible();

  // The laptop's library updates by itself.
  await expect(page.getByRole("list", { name: "Saves" })).toContainText(IG_URL);

  // Saving it on the laptop too: the server already has it.
  await page.goto(save({ url: IG_URL }));
  await expect(page.getByRole("heading", { name: "Already saved" })).toBeVisible();

  expect(phoneCsp).toEqual([]);
  await phoneContext.close();
});

test("a link shared while signed out waits on the device and is saved after sign-in", async ({ page, request }) => {
  const email = uniqueEmail("later");
  const uid = await createUser(request, email, true);
  await page.goto(share({ title: "Great thread", text: "https://x.com/someone/status/1234567890123456789?s=46&t=AbC" }));
  await expect(page.getByRole("heading", { name: "Sign in to save this" })).toBeVisible();
  await expect(page.getByText("X post · @someone")).toBeVisible();

  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login\/\?next=%2Fsave%2F$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/save\/$/);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  expect(await saveDoc(request, uid, "x_1234567890123456789")).toMatchObject({ source: "share-android", author: "someone" });

  // It has left the waiting list.
  await page.goto("/save/");
  await expect(page.getByRole("heading", { name: "Save a post" })).toBeVisible();
});

test("a new account's first share waits for email verification, then saves", async ({ page, request }) => {
  const email = uniqueEmail("firstshare");
  await page.goto(share({ text: "https://www.reddit.com/r/aww/comments/abc123/so_cute/?utm_source=share" }));
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const link = await emailLink(request, email, "VERIFY_EMAIL");
  expect(link, "a verification email was sent").toBeTruthy();
  await request.get(link!);
  await page.getByRole("button", { name: "I've verified it" }).click();

  await expect(page).toHaveURL(/\/save\/$/);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Reddit post")).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
});

test("the library saves links left waiting when sign-in happened somewhere else", async ({ page, request }) => {
  const email = uniqueEmail("waiting");
  await createUser(request, email, true);
  await page.goto(share({ text: IG_SHARE }));
  await expect(page.getByRole("heading", { name: "Sign in to save this" })).toBeVisible();
  await page.goto(share({ text: "https://www.pinterest.com/pin/123456789012345678/" }));
  await expect(page.getByRole("heading", { name: "Sign in to save this" })).toBeVisible();

  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByText("The 2 links you shared before signing in are saved.")).toBeVisible();
  const list = page.getByRole("list", { name: "Saves" });
  await expect(list).toContainText("instagram.com/reel/C8xYz12AbCd");
  await expect(list).toContainText("pinterest.com/pin/123456789012345678");
});

test("shared text without a link says so, and a pasted link saves", async ({ page, request }) => {
  const { uid } = await signedIn(page, request);
  await page.goto(share({ title: "Hello", text: "just some words" }));
  await expect(page.getByRole("heading", { name: "No link found" })).toBeVisible();
  await expect(page.getByText("just some words")).toBeVisible();

  await page.getByLabel("Link to a post").fill("not a link");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't look like a link");

  await page.getByLabel("Link to a post").fill("youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  expect(await saveDoc(request, uid, "youtube_dQw4w9WgXcQ")).toMatchObject({ source: "paste" });
});

test("a save made offline waits on the device and syncs when the connection is back", async ({ page, context, request }) => {
  const { uid } = await signedIn(page, request);
  await page.goto("/save/");
  await expect(page.getByRole("heading", { name: "Save a post" })).toBeVisible();

  await context.setOffline(true);
  await page.getByLabel("Link to a post").fill("https://www.tiktok.com/@creator/video/7234567890123456789?is_from_webapp=1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Saved on this device. It syncs when you're back online.")).toBeVisible();
  expect(await saveDoc(request, uid, "tiktok_7234567890123456789")).toBeNull();

  await context.setOffline(false);
  await expect(page.getByText("Synced to your library.")).toBeVisible({ timeout: 30_000 });
  expect(await saveDoc(request, uid, "tiktok_7234567890123456789")).toMatchObject({ source: "paste", author: "creator" });
});

test("an offline save of a post another device already saved turns into 'Already saved', not a copy", async ({ page, context, request }) => {
  const { uid } = await signedIn(page, request);
  const link = parse(IG_URL);
  if (!link) throw new Error("parse failed");
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  // Saved from another device; this one has never seen it.
  await writeDoc(request, `users/${uid}/saves/${IG_ID}`, newSave(link, { source: "web", now: weekAgo }));
  await page.goto("/save/");
  await expect(page.getByRole("heading", { name: "Save a post" })).toBeVisible();

  await context.setOffline(true);
  await page.getByLabel("Link to a post").fill(IG_SHARE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device. It syncs when you're back online.")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Already saved" })).toBeVisible({ timeout: 30_000 });
  // The server kept the original save untouched.
  expect(await saveDoc(request, uid, IG_ID)).toMatchObject({ source: "web", savedAt: weekAgo.toISOString() });
});

test("sharing a post that's in the Trash brings it back", async ({ page, request }) => {
  const { uid } = await signedIn(page, request);
  const link = parse(IG_URL);
  if (!link) throw new Error("parse failed");
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  await writeDoc(request, `users/${uid}/saves/${IG_ID}`, {
    ...newSave(link, { source: "web", now: weekAgo }),
    status: "trashed",
    trashedAt: new Date(),
  });

  await page.goto(share({ text: IG_SHARE }));
  await expect(page.getByRole("heading", { name: "Restored from Trash" })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  const restored = await saveDoc(request, uid, IG_ID);
  expect(restored).toMatchObject({ status: "active", source: "web" });
  expect(restored).not.toHaveProperty("trashedAt");
  expect(new Date(String(restored?.savedAt)).getTime()).toBeGreaterThan(weekAgo.getTime());
});

test("opened as a popup (the bookmarklet), the page closes itself once saved", async ({ page, request }) => {
  const { uid } = await signedIn(page, request);
  const popupOpened = page.waitForEvent("popup");
  const target = save({ url: "https://bsky.app/profile/did:plc:abcdefghijklmnopqrstuvwx/post/3kabcdefghi2x", src: "bookmarklet" });
  await page.evaluate((url) => window.open(url, "ps-save", "width=420,height=560"), target);
  const popup = await popupOpened;
  const popupCsp = watchCsp(popup);
  await expect(popup.getByText(/This window closes in a moment/)).toBeVisible();
  await popup.waitForEvent("close");
  expect(popupCsp).toEqual([]);
  expect(await saveDoc(request, uid, "bluesky_did:plc:abcdefghijklmnopqrstuvwx_3kabcdefghi2x")).toMatchObject({
    source: "bookmarklet",
  });
});

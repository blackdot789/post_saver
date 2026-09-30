import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse, tombstone } from "@postsaver/core";
import { createUser, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// The sync engine and status indicator (CLAUDE.md §6.5, §11): changes from other devices arrive
// live, deletes propagate, the watermark persists, a wiped cache resyncs, the delete timeline runs.

const DAY = 24 * 3600 * 1000;
const IG_URL = "https://www.instagram.com/reel/C8xYz12AbCd/";
const YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
// How a card shows those links: the site, then the path.
const IG_SHOWN = "instagram.com/reel/C8xYz12AbCd";
const YT_SHOWN = "youtube.com/watch?v=dQw4w9WgXcQ";

function docFor(url: string, at: Date) {
  const link = parse(url);
  if (!link) throw new Error(`parse failed for ${url}`);
  return newSave(link, { source: "web", now: at });
}

/** Writes a save as another device would have (server times in the past or now). */
const fromOtherDevice = (request: APIRequestContext, uid: string, id: string, url: string, at = new Date()) =>
  writeDoc(request, `users/${uid}/saves/${id}`, docFor(url, at));

async function openLibrary(page: Page, request: APIRequestContext) {
  const email = uniqueEmail("sync");
  const uid = await createUser(request, email, true);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  return { email, uid };
}

const status = (page: Page) => page.getByRole("status").filter({ hasText: /Synced|Syncing|Offline|paused/ });
const saves = (page: Page) => page.getByRole("list", { name: "Saves" });

test("changes from another device arrive live, and so do deletes", async ({ page, request }) => {
  const { uid } = await openLibrary(page, request);
  await expect(status(page)).toHaveText("Synced");
  await expect(status(page)).toHaveAttribute("data-sync-mode", "full");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();

  await fromOtherDevice(request, uid, "instagram_C8xYz12AbCd", IG_URL);
  await expect(saves(page)).toContainText(IG_SHOWN);
  await expect(status(page)).toHaveText("Synced");

  // Deleted on the other device: only a tombstone remains, and the row goes.
  await writeDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`, tombstone(new Date()));
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

test("a device remembers where it left off and picks up what changed while it was away", async ({ page, request }) => {
  const { uid } = await openLibrary(page, request);
  await fromOtherDevice(request, uid, "instagram_C8xYz12AbCd", IG_URL);
  await expect(saves(page)).toContainText(IG_SHOWN);
  await expect(status(page)).toHaveText("Synced");
  const record = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), `ps:sync:${uid}`);
  expect(record).toMatchObject({ epoch: 0 });
  expect(record.watermarkMs).toBeGreaterThan(Date.now() - 60_000);

  // While the page is closed, another device saves something.
  await page.goto("about:blank");
  await fromOtherDevice(request, uid, "youtube_dQw4w9WgXcQ", YT_URL);
  await page.goto("/app/");
  await expect(saves(page)).toContainText(YT_SHOWN);
  await expect(saves(page)).toContainText(IG_SHOWN);
  await expect(status(page)).toHaveText("Synced");
  // Only what changed since the last visit was fetched.
  await expect(status(page)).toHaveAttribute("data-sync-mode", "delta");
  const later = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), `ps:sync:${uid}`);
  expect(later.watermarkMs).toBeGreaterThanOrEqual(record.watermarkMs);

  // An admin bumps the account's sync epoch: every device fetches everything again.
  await writeDoc(request, `users/${uid}`, { syncEpoch: 1 }, ["syncEpoch"]);
  await expect(status(page)).toHaveAttribute("data-sync-mode", "full");
  await expect(status(page)).toHaveText("Synced");
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), `ps:sync:${uid}`)).toMatchObject({ epoch: 1 });
});

test("a wiped device cache leads to a full resync", async ({ page, request }) => {
  const { uid, email } = await openLibrary(page, request);
  await fromOtherDevice(request, uid, "instagram_C8xYz12AbCd", IG_URL);
  await fromOtherDevice(request, uid, "youtube_dQw4w9WgXcQ", YT_URL);
  await expect(saves(page)).toContainText(YT_SHOWN);
  await expect(status(page)).toHaveText("Synced");

  // The browser (or the user) clears site data (which signs the user out too), but the sync
  // record in localStorage survives and must not be trusted on its own.
  await page.goto("about:blank");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Storage.clearDataForOrigin", { origin: "http://localhost:4173", storageTypes: "indexeddb" });
  await page.goto("/login/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(saves(page)).toContainText(IG_SHOWN);
  await expect(saves(page)).toContainText(YT_SHOWN);
  await expect(status(page)).toHaveText("Synced");
  await expect(status(page)).toHaveAttribute("data-sync-mode", "full");
});

test("offline is shown, and sync resumes by itself", async ({ page, context, request }) => {
  await openLibrary(page, request);
  await expect(status(page)).toHaveText("Synced");
  await context.setOffline(true);
  await expect(status(page)).toHaveText("Offline");
  await context.setOffline(false);
  await expect(status(page)).toHaveText("Synced", { timeout: 30_000 });
});

test("signing out wipes the device copy of the library", async ({ page, request }) => {
  const { uid } = await openLibrary(page, request);
  await fromOtherDevice(request, uid, "instagram_C8xYz12AbCd", IG_URL);
  await expect(saves(page)).toContainText(IG_SHOWN);
  const before = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ""));
  expect(before.some((n) => n.startsWith("firestore/"))).toBe(true);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\//);
  const after = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ""));
  expect(after.some((n) => n.startsWith("firestore/"))).toBe(false);
});

test("opening the library runs the delete timeline: old trash becomes a tombstone, old tombstones go", async ({ page, request }) => {
  const email = uniqueEmail("purge");
  const uid = await createUser(request, email, true);
  const oldTrash = { ...docFor(IG_URL, new Date(Date.now() - 40 * DAY)), status: "trashed", trashedAt: new Date(Date.now() - 31 * DAY) };
  await writeDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`, oldTrash);
  await writeDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`, tombstone(new Date(Date.now() - 62 * DAY)));
  await writeDoc(request, `users/${uid}/saves/x_1234567890123456789`, tombstone(new Date(Date.now() - 10 * DAY)));

  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(status(page)).toHaveText("Synced");

  await expect.poll(() => readDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`), { timeout: 15_000 }).toBeNull();
  await expect.poll(() => readDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`)).toMatchObject({ deleted: true });
  expect(await readDoc(request, `users/${uid}/saves/x_1234567890123456789`)).toMatchObject({ deleted: true });
});

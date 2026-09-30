import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse } from "@postsaver/core";
import { createUser, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// The library (CLAUDE.md §6.6): views, search, filters, tags, collections, notes, favorites,
// bulk actions, the Trash, settings and keyboard shortcuts. Previews are "only when I tap" here,
// so no platform is contacted.

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const IG = "https://www.instagram.com/natgeo/reel/C8xYz12AbCd/";
const TWEET = "https://x.com/someone/status/1234567890123456789";
const IDS = { yt: "youtube_dQw4w9WgXcQ", ig: "instagram_C8xYz12AbCd", x: "x_1234567890123456789" };

async function seed(request: APIRequestContext, uid: string, id: string, url: string, at: Date, extra: Record<string, unknown> = {}) {
  const link = parse(url);
  if (!link) throw new Error(`parse failed for ${url}`);
  await writeDoc(request, `users/${uid}/saves/${id}`, { ...newSave(link, { source: "web", now: at }), ...extra });
}

const day = (n: number) => new Date(2026, 8, n);

/** A signed-in account with three saves (YouTube, Instagram, X) and previews off. */
async function library(page: Page, request: APIRequestContext) {
  const email = uniqueEmail("lib");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, { email, createdAt: new Date(), updatedAt: new Date(), settings: { previews: "click" }, schemaVersion: 1 });
  await seed(request, uid, IDS.yt, YT, day(1), { title: "Never Gonna Give You Up", tags: ["music"], favorite: true });
  await seed(request, uid, IDS.ig, IG, day(2), { tags: ["wildlife", "music"], note: "Watch with the kids" });
  await seed(request, uid, IDS.x, TWEET, day(3));
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByRole("list", { name: "Saves" })).toBeVisible();
  return { email, uid };
}

const cards = (page: Page) => page.locator("[data-save-id]");
const card = (page: Page, id: string) => page.locator(`[data-save-id="${id}"]`);
const save = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);

test("search, platform chips, tags and sort narrow the library, and the query lives in the address bar", async ({ page, request }) => {
  await library(page, request);
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByRole("status").filter({ hasText: "3 saves" })).toBeVisible();

  await page.getByRole("searchbox").fill("kids");
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, IDS.ig)).toBeVisible();
  await expect(page).toHaveURL(/\?q=kids$/);
  await page.getByRole("searchbox").fill("");

  await page.getByRole("button", { name: "YouTube", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page).toHaveURL(/platform=youtube/);
  await page.getByRole("button", { name: "All", exact: true }).click();

  await page.getByRole("button", { name: /^music \d/ }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page).toHaveURL(/tag=music/);

  await page.goto("/app/?sort=oldest");
  await expect(cards(page)).toHaveCount(3);
  const order = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-save-id")));
  expect(order).toEqual([IDS.yt, IDS.ig, IDS.x]);
});

test("favorites, tags and a note from the card menu are stored and shown", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await card(page, IDS.x).getByRole("button", { name: "Add to favorites" }).click();
  await expect.poll(() => save(request, uid, IDS.x)).toMatchObject({ favorite: true });
  await page.getByRole("button", { name: /^Favorites/ }).click();
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole("button", { name: /^All saves/ }).click();

  await card(page, IDS.x).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Tags…" }).click();
  await page.getByRole("dialog").getByLabel("Tags", { exact: true }).fill("Thread, tech");
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove tag thread" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(card(page, IDS.x).getByRole("list", { name: "Tags" })).toContainText("thread");
  await expect.poll(() => save(request, uid, IDS.x)).toMatchObject({ tags: ["thread", "tech"] });

  await card(page, IDS.x).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Note…" }).click();
  await page.getByRole("dialog").getByLabel("Note").fill("Read later");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(card(page, IDS.x)).toContainText("Read later");
});

test("collections: create, add a save, filter by it, rename and delete", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Tech");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: "Tech", exact: true })).toBeVisible();

  await card(page, IDS.x).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Collections…" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Tech" }).check();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(card(page, IDS.x)).toContainText("In Tech");

  await page.getByRole("button", { name: "Tech", exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page).toHaveURL(/collection=[A-Za-z0-9]+/);

  await page.getByRole("button", { name: "Rename or delete Tech" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Technology");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Technology", exact: true })).toBeVisible();
  await expect(card(page, IDS.x)).toContainText("In Technology");

  await page.getByRole("button", { name: "Rename or delete Technology" }).click();
  await page.getByRole("button", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete collection" }).click();
  await expect(page.getByRole("button", { name: "Technology", exact: true })).toHaveCount(0);
  // The save stays; the collection is a tombstone.
  expect(await save(request, uid, IDS.x)).toMatchObject({ status: "active" });
});

test("trash, restore and delete forever, one by one and in bulk", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await card(page, IDS.yt).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect.poll(() => save(request, uid, IDS.yt)).toMatchObject({ status: "trashed" });

  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, IDS.yt)).toContainText("In the Trash");
  await card(page, IDS.yt).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect(page.getByText("The Trash is empty.")).toBeVisible();
  await expect.poll(() => save(request, uid, IDS.yt)).toMatchObject({ status: "active" });

  // Bulk: select two, trash them, then delete them forever from the Trash.
  await page.getByRole("button", { name: /^All saves/ }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByLabel(/^Select Instagram/).check();
  await page.getByLabel(/^Select X/).check();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Move to Trash" }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.getByRole("button", { name: /^Trash/ }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await page.getByRole("region", { name: "Selected saves" }).getByRole("button", { name: "Delete forever" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete forever" }).click();
  await expect(page.getByText("The Trash is empty.")).toBeVisible();
  await expect.poll(() => save(request, uid, IDS.ig)).toMatchObject({ deleted: true });
  await expect.poll(() => save(request, uid, IDS.x)).toMatchObject({ deleted: true });
});

test("bulk tags and collections, and the list layout", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await page.getByRole("button", { name: "Add tags" }).click();
  await page.getByLabel("Tags, separated by commas").fill("later");
  await page.getByRole("dialog").getByRole("button", { name: "Add tags" }).click();
  await expect.poll(async () => (await save(request, uid, IDS.x))?.tags).toEqual(["later"]);
  await expect.poll(async () => (await save(request, uid, IDS.yt))?.tags).toEqual(["music", "later"]);

  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByLabel("New collection").fill("Weekend");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Weekend" })).toBeChecked();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(async () => (await save(request, uid, IDS.ig))?.collectionIds).toHaveLength(1);

  await page.getByRole("button", { name: "list" }).click();
  await expect(cards(page)).toHaveCount(3);
  await expect(card(page, IDS.yt)).toContainText("Never Gonna Give You Up");
  await expect.poll(() => readDoc(request, `users/${uid}`)).toMatchObject({ settings: { view: "list" } });
  await page.reload();
  await expect(page.getByRole("button", { name: "list" })).toHaveAttribute("aria-pressed", "true");
});

test("settings: the theme applies at once and is remembered; the Add dialog saves a link", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Dark").check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => readDoc(request, `users/${uid}`)).toMatchObject({ settings: { theme: "dark" } });
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Link to a post").fill("https://www.pinterest.com/pin/123456789012345678/");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Synced to your library.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(cards(page)).toHaveCount(4);
  await expect(card(page, "pinterest_123456789012345678")).toBeVisible();
});

test("keyboard shortcuts: / searches, n adds, f and e act on the focused card", async ({ page, request }) => {
  const { uid } = await library(page, request);
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 } });

  await card(page, IDS.x).focus();
  await page.keyboard.press("f");
  await expect.poll(() => save(request, uid, IDS.x)).toMatchObject({ favorite: true });
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Tags" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog", { name: "Save a link" })).toBeVisible();
});

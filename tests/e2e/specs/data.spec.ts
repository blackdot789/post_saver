import { readFile } from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse, saveId } from "@postsaver/core";
import { strToU8, zipSync } from "fflate";
import { accountExists, createUser, listDocs, PASSWORD, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// Import, export and deleting the account (CLAUDE.md §6.1, §6.8, §11): Settings → "Your data".
// Previews are "only when I tap", so no platform is contacted.

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const REEL = "https://www.instagram.com/reel/C8xYz12AbCd/";
const REEL_ID = "instagram_C8xYz12AbCd";

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<DL><p>
    <DT><H3>Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="${YT}" ADD_DATE="1700000100">Rick Astley</A>
        <DT><H3>Recipes</H3>
        <DL><p>
            <DT><A HREF="https://example.com/pasta" ADD_DATE="1700000300" TAGS="dinner,Quick">Pasta for two</A>
            <DT><A HREF="javascript:alert(1)">A bookmarklet</A>
        </DL><p>
        <DT><A HREF="https://x.com/jack/status/20">First post</A>
    </DL><p>
</DL><p>`;

async function account(request: APIRequestContext) {
  const email = uniqueEmail("data");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, { email, createdAt: new Date(), updatedAt: new Date(), settings: { previews: "click" }, schemaVersion: 1 });
  return { email, uid };
}

async function seed(request: APIRequestContext, uid: string, url: string, extra: Record<string, unknown> = {}): Promise<string> {
  const link = parse(url);
  if (!link) throw new Error(`parse failed for ${url}`);
  const id = await saveId(link);
  await writeDoc(request, `users/${uid}/saves/${id}`, { ...newSave(link, { source: "web", now: new Date(2026, 8, 1) }), ...extra });
  return id;
}

async function open(page: Page, email: string) {
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByRole("status").filter({ hasText: "Synced" })).toBeVisible();
}

async function settings(page: Page, button: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
}

async function pick(page: Page, name: string, content: string | Buffer) {
  await settings(page, "Import…");
  await page.getByLabel("File to import").setInputFiles({ name, mimeType: "application/octet-stream", buffer: typeof content === "string" ? Buffer.from(content) : content });
}

const cards = (page: Page) => page.locator("[data-save-id]");
const save = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);
const will = (page: Page) => page.getByRole("list", { name: "What the import will do" });

test("a bookmarks file: what it will do is shown first, then saves arrive with their dates, tags and folders", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await open(page, email);
  await pick(page, "bookmarks.html", BOOKMARKS);

  await expect(page.getByRole("dialog")).toContainText("bookmarks.html is browser bookmarks with 3 posts.");
  await expect(will(page)).toContainText("3 new posts will be added");
  await expect(will(page)).toContainText("1 entry had no usable link");
  await expect(will(page)).toContainText("Collections: Recipes");
  await page.getByRole("button", { name: "Import 3 posts" }).click();

  await expect(page.getByText("Import finished: 3 posts added.")).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  expect(await save(request, uid, "youtube_dQw4w9WgXcQ")).toMatchObject({ source: "import-bookmarks", savedAt: "2023-11-14T22:15:00Z", needsMeta: true });
  expect(await save(request, uid, "x_20")).toMatchObject({ source: "import-bookmarks", author: "jack" });
  // An ordinary page keeps the bookmark's title, and sits in the collection made from its folder.
  const pastaId = (await listDocs(request, `users/${uid}/saves`)).find((id) => id.startsWith("url_")) ?? "";
  const pasta = await save(request, uid, pastaId);
  expect(pasta).toMatchObject({ url: "https://example.com/pasta", title: "Pasta for two", tags: ["dinner", "quick"], needsMeta: false });
  const [collectionId] = await listDocs(request, `users/${uid}/collections`);
  expect(pasta?.collectionIds).toEqual([collectionId]);
  expect(await readDoc(request, `users/${uid}/collections/${collectionId}`)).toMatchObject({ name: "Recipes" });
  await expect(page.getByRole("button", { name: "Recipes", exact: true })).toBeVisible();
  // The account's record of the import.
  const [importId] = await listDocs(request, `users/${uid}/imports`);
  await expect.poll(() => readDoc(request, `users/${uid}/imports/${importId}`)).toMatchObject({ type: "bookmarks", total: 3, done: 3, status: "done" });

  // The same file again: nothing new.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await pick(page, "bookmarks.html", BOOKMARKS);
  await expect(will(page)).toContainText("3 are in your library already");
  await expect(page.getByText("There's nothing new in this file.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import \d/ })).toHaveCount(0);
});

test("an Instagram export: new posts are added, and posts unsaved on Instagram since the last import go to the Trash when asked", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await seed(request, uid, REEL, { source: "import-instagram" });
  const unsaved = await seed(request, uid, "https://www.instagram.com/p/CUnsavedNow1/", { source: "import-instagram" });
  // Shared by hand, not from an export: an import never touches it.
  const shared = await seed(request, uid, "https://www.instagram.com/p/CSharedOnce1/", { source: "share-android" });
  await open(page, email);
  await expect(cards(page)).toHaveCount(3);

  const zip = zipSync({
    "your_instagram_activity/saved/saved_posts.json": strToU8(
      JSON.stringify({
        saved_saved_media: [
          { title: "natgeo", string_map_data: { "Saved on": { href: REEL, timestamp: 1_758_000_000 } } },
          { title: "chef", string_map_data: { "Saved on": { href: "https://www.instagram.com/p/CabcDEF1234/", timestamp: 1_757_000_000 } } },
        ],
      }),
    ),
    "your_instagram_activity/saved/saved_collections.json": strToU8(
      JSON.stringify({
        saved_saved_collections: [
          { title: "Collection", string_map_data: { Name: { value: "CafÃ©s" }, "Creation Time": { timestamp: 1_750_000_000 } } },
          { string_map_data: { Name: { value: "chef", href: "https://www.instagram.com/p/CabcDEF1234/" }, "Added Time": { timestamp: 1_757_500_000 } } },
        ],
      }),
    ),
    "media/posts/photo.jpg": new Uint8Array(20_000),
  });
  await pick(page, "instagram-download.zip", Buffer.from(zip));

  await expect(page.getByRole("dialog")).toContainText("instagram-download.zip is an Instagram export with 2 posts.");
  await expect(will(page)).toContainText("1 new post will be added");
  await expect(will(page)).toContainText("1 is in your library already");
  await expect(will(page)).toContainText("Collections: Cafés");
  await expect(page.getByRole("group", { name: /1 post from an earlier Instagram import isn't in this file/ })).toBeVisible();
  await expect(page.getByLabel("Keep them in my library")).toBeChecked();
  await page.getByLabel("Move them to the Trash").check();
  await page.getByRole("button", { name: "Import 1 post" }).click();

  await expect(page.getByText("Import finished: 1 post added, 1 updated.")).toBeVisible();
  await expect.poll(() => save(request, uid, unsaved)).toMatchObject({ status: "trashed" });
  expect(await save(request, uid, shared)).toMatchObject({ status: "active" });
  expect(await save(request, uid, REEL_ID)).toMatchObject({ status: "active" });
  const [collectionId] = await listDocs(request, `users/${uid}/collections`);
  expect(await save(request, uid, "instagram_CabcDEF1234")).toMatchObject({ source: "import-instagram", savedAt: "2025-09-04T15:33:20Z", collectionIds: [collectionId] });
  expect(await readDoc(request, `users/${uid}/collections/${collectionId}`)).toMatchObject({ name: "Cafés" });
  // The choice is remembered for the next import.
  await expect.poll(() => readDoc(request, `users/${uid}`)).toMatchObject({ settings: { onUnsave: "remove" } });
});

test("an import can be paused and resumed, also across a reload", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { email, uid } = await account(request);
  await open(page, email);
  await pick(page, "links.csv", ["url", ...Array.from({ length: 100 }, (_, i) => `https://example.com/page-${i}`)].join("\n"));
  await page.getByRole("button", { name: "Import 100 posts" }).click();

  const banner = page.locator("[data-import]");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(banner).toHaveAttribute("data-import", "paused");
  const where = await banner.innerText();
  expect(where).toMatch(/Import paused at \d+ of 100\./);
  await page.waitForTimeout(1200);
  expect(await banner.innerText()).toBe(where);
  const [importId] = await listDocs(request, `users/${uid}/imports`);
  await expect.poll(() => readDoc(request, `users/${uid}/imports/${importId}`)).toMatchObject({ status: "paused" });

  await page.reload();
  await expect(banner).toHaveAttribute("data-import", "paused");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Import finished: 100 posts added.")).toBeVisible({ timeout: 20_000 });
  // The saves are on the device at once; they reach the server one by one.
  await expect.poll(async () => (await listDocs(request, `users/${uid}/saves`)).length, { timeout: 60_000 }).toBe(100);
});

test("a big import stops at the day's limit and carries on the next day; it can be held remotely and cancelled", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await writeDoc(request, "config/app", { importDailyCap: 2 });
  try {
    await open(page, email);
    const links = Array.from({ length: 7 }, (_, i) => `https://example.com/article-${i}`).join("\n");
    await pick(page, "links.txt", links);
    await expect(will(page)).toContainText("7 new posts will be added");
    await expect(page.getByRole("dialog")).toContainText("Imports add up to 2 posts a day. This one takes about 4 days");
    await page.getByRole("button", { name: "Import 7 posts" }).click();

    const banner = page.locator("[data-import]");
    await expect(banner).toHaveAttribute("data-import", "waiting");
    await expect(banner).toContainText("2 of 7 imported. Imports add up to 2 posts a day: the rest continues tomorrow");
    await expect(cards(page)).toHaveCount(2);
    expect(await listDocs(request, `users/${uid}/saves`)).toHaveLength(2);
    const [importId] = await listDocs(request, `users/${uid}/imports`);
    await expect.poll(() => readDoc(request, `users/${uid}/imports/${importId}`)).toMatchObject({ total: 7, done: 2, status: "running" });

    // "Tomorrow": yesterday's count no longer applies. The import resumes by itself after a reload.
    const nextDay = () => page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ day: "2000-01-01", count: 2 })), `ps:import-day:${uid}`);
    await nextDay();
    await page.reload();
    await expect(banner).toContainText("4 of 7 imported.");
    await expect(cards(page)).toHaveCount(4);

    // Switched off for everyone: it waits, and says so.
    await writeDoc(request, "config/app", { importDailyCap: 2, importPaused: true });
    await nextDay();
    await page.reload();
    await expect(banner).toHaveAttribute("data-import", "held");
    await expect(banner).toContainText("Imports are switched off for a moment");
    await page.waitForTimeout(1500);
    expect(await listDocs(request, `users/${uid}/saves`)).toHaveLength(4);

    // Back on: two more today, and the last one once there's room.
    await writeDoc(request, "config/app", { importDailyCap: 2, importPaused: false });
    await expect(banner).toContainText("6 of 7 imported.");
    await writeDoc(request, "config/app", { importDailyCap: 500 });
    await nextDay();
    await page.reload();
    await expect(page.getByText("Import finished: 7 posts added.")).toBeVisible();
    await expect(cards(page)).toHaveCount(7);
    await expect.poll(() => readDoc(request, `users/${uid}/imports/${importId}`)).toMatchObject({ done: 7, status: "done" });

    // A second import, cancelled part-way: what was added stays.
    await writeDoc(request, "config/app", { importDailyCap: 1 });
    await nextDay();
    await page.reload();
    await pick(page, "more.txt", "https://example.com/more-1\nhttps://example.com/more-2\nhttps://example.com/more-3");
    await page.getByRole("button", { name: "Import 3 posts" }).click();
    await expect(banner).toContainText("1 of 3 imported.");
    await page.getByRole("button", { name: "Cancel import" }).click();
    await expect(page.getByText("Import finished: 1 post added.")).toBeVisible();
    await page.reload();
    await expect(cards(page)).toHaveCount(8);
    await expect(banner).toHaveCount(0);
  } finally {
    await writeDoc(request, "config/app", {});
  }
});

test("export: three files made on the device; the JSON one brings everything back into another account", async ({ page, request, browser }) => {
  const { email, uid } = await account(request);
  await writeDoc(request, `users/${uid}/collections/Recipes1`, { name: "Recipes", order: 0, createdAt: new Date(), updatedAt: new Date(), deleted: false });
  await seed(request, uid, YT, { title: "Never Gonna Give You Up", tags: ["music"], note: "A classic", favorite: true, collectionIds: ["Recipes1"], savedAt: new Date(Date.UTC(2025, 2, 4, 5, 6, 7)) });
  await seed(request, uid, REEL, { status: "trashed", trashedAt: new Date() });
  await open(page, email);
  await settings(page, "Export…");
  await expect(page.getByRole("dialog")).toContainText("Download 1 save as a file.");
  await expect(page.getByRole("dialog")).toContainText("The 1 save in the Trash is only in the JSON file.");

  const fetchFile = async (label: string) => {
    const started = page.waitForEvent("download");
    await page.getByRole("button", { name: `Download ${label}` }).click();
    const download = await started;
    return { name: download.suggestedFilename(), text: await readFile(await download.path(), "utf8") };
  };
  const json = await fetchFile("Everything (JSON)");
  expect(json.name).toMatch(/^postsaver-export-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(json.text) as { saves: Array<Record<string, unknown>>; collections: unknown[] };
  expect(data.saves).toHaveLength(2);
  expect(data.saves.find((s) => s.url === YT)).toMatchObject({ title: "Never Gonna Give You Up", tags: ["music"], note: "A classic", favorite: true, collections: ["Recipes"], savedAt: "2025-03-04T05:06:07.000Z", status: "active" });
  expect(data.collections).toEqual([{ name: "Recipes" }]);

  const csv = await fetchFile("Spreadsheet (CSV)");
  expect(csv.name).toMatch(/\.csv$/);
  expect(csv.text).toContain("url,title,platform,author,tags,note,collections,favorite,saved at");
  expect(csv.text).toContain(`${YT},Never Gonna Give You Up,youtube,,music,A classic,Recipes,yes,2025-03-04T05:06:07.000Z`);
  expect(csv.text).not.toContain("C8xYz12AbCd");

  const html = await fetchFile("Bookmarks (HTML)");
  expect(html.text).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
  expect(html.text).toContain(`<DT><A HREF="${YT}" ADD_DATE="1741064767" TAGS="music">Never Gonna Give You Up</A>`);

  // Into a fresh account, in another browser: the save comes back as it was, the trashed one doesn't.
  const other = await account(request);
  const context = await browser.newContext();
  const page2 = await context.newPage();
  await context.route("http://127.0.0.1:8788/**", (route) => route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await open(page2, other.email);
  await pick(page2, json.name, json.text);
  await expect(page2.getByRole("dialog")).toContainText("is an export of this app with 1 post.");
  await page2.getByRole("button", { name: "Import 1 post" }).click();
  await expect(page2.getByText("Import finished: 1 post added.")).toBeVisible();
  const [collectionId] = await listDocs(request, `users/${other.uid}/collections`);
  expect(await save(request, other.uid, "youtube_dQw4w9WgXcQ")).toMatchObject({ tags: ["music"], note: "A classic", favorite: true, collectionIds: [collectionId], savedAt: "2025-03-04T05:06:07Z", source: "import-backup" });
  expect(await listDocs(request, `users/${other.uid}/saves`)).toEqual(["youtube_dQw4w9WgXcQ"]);
  await context.close();
});

test("deleting the account: the password is asked again, then everything goes, on the server and on the device", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await seed(request, uid, YT);
  await seed(request, uid, REEL, { status: "trashed", trashedAt: new Date() });
  await writeDoc(request, `users/${uid}/saves/x_20`, { deleted: true, updatedAt: new Date(), schemaVersion: 1 });
  await writeDoc(request, `users/${uid}/collections/Recipes1`, { name: "Recipes", order: 0, createdAt: new Date(), updatedAt: new Date(), deleted: false });
  await writeDoc(request, `users/${uid}/imports/Import1`, { type: "csv", total: 1, done: 1, cursor: 1, status: "done", createdAt: new Date(), updatedAt: new Date() });
  await open(page, email);

  await settings(page, "Delete account…");
  const dialog = page.getByRole("dialog", { name: "Delete your account" });
  await expect(dialog).toContainText(`This deletes your account (${email}) with all 2 saves`);
  const confirm = dialog.getByRole("button", { name: "Delete my account" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("I understand that my saves can't be brought back.").check();

  // The wrong password: nothing is deleted.
  await dialog.getByLabel("Your password, to confirm it's you").fill("not the password");
  await confirm.click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(await listDocs(request, `users/${uid}/saves`)).toHaveLength(3);
  expect(await readDoc(request, `users/${uid}`)).not.toMatchObject({ deleting: true });

  await dialog.getByLabel("Your password, to confirm it's you").fill(PASSWORD);
  await confirm.click();
  await expect(page).toHaveURL(/\/login\/\?deleted=1$/);
  await expect(page.getByText("Your account and everything in it were deleted.")).toBeVisible();

  expect(await listDocs(request, `users/${uid}/saves`)).toEqual([]);
  expect(await listDocs(request, `users/${uid}/collections`)).toEqual([]);
  expect(await listDocs(request, `users/${uid}/imports`)).toEqual([]);
  expect(await readDoc(request, `users/${uid}`)).toBeNull();
  expect(await accountExists(request, email)).toBe(false);
  // Nothing of the account is left in this browser.
  const left = await page.evaluate(async () => ({
    keys: Object.keys(localStorage).filter((k) => k.startsWith("ps:")),
    databases: (await indexedDB.databases()).map((d) => d.name ?? "").filter((name) => name.startsWith("firestore/") || name.startsWith("ps-")),
  }));
  expect(left).toEqual({ keys: [], databases: [] });
});

test("a deletion that didn't finish is offered again, and can be called off", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await seed(request, uid, YT);
  await writeDoc(request, `users/${uid}`, { deleting: true }, ["deleting"]);
  await open(page, email);
  await expect(page.getByText("This account is being deleted")).toBeVisible();
  await page.getByRole("button", { name: "Finish deleting" }).click();
  await expect(page.getByRole("dialog", { name: "Finish deleting your account" })).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByText("This account is being deleted")).toHaveCount(0);
  await expect.poll(() => readDoc(request, `users/${uid}`)).toMatchObject({ deleting: false });
  expect(await listDocs(request, `users/${uid}/saves`)).toHaveLength(1);
});

test("the library refuses to show inside another site's frame", async ({ page, request }) => {
  const { email } = await account(request);
  await open(page, email);
  // The embed sandbox's origin stands in for "another site".
  await page.goto("http://localhost:4174/");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.src = "http://localhost:4173/app/";
    frame.style.cssText = "width:600px;height:400px";
    document.body.append(frame);
  });
  const framed = page.frameLocator("iframe");
  await expect(framed.getByRole("link", { name: "Open your library in its own tab" })).toBeVisible();
  await expect(framed.getByRole("button", { name: "Settings" })).toHaveCount(0);
});

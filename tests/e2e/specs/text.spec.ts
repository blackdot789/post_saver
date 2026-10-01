import { readFile } from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import { cleanText, newSave, newText, parse, textId } from "@postsaver/core";
import { createUser, listDocs, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test, watchCsp } from "./fixtures.ts";

// Saved text (CLAUDE.md §6.1): a text typed, pasted or shared on one device shows up in the
// library on the others, where one tap copies it. It's a save like a post: it syncs, can be
// searched, tagged, trashed, exported and imported.

const CODE = "Gate code 4821#\nSecond door on the left";
const share = (params: Record<string, string>) => `/share/?${new URLSearchParams(params)}`;
const cards = (page: Page) => page.locator("[data-save-id]");
const card = (page: Page, id: string) => page.locator(`[data-save-id="${id}"]`);
const saveDoc = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);

async function account(request: APIRequestContext) {
  const email = uniqueEmail("text");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, { email, createdAt: new Date(), updatedAt: new Date(), settings: { previews: "click" }, schemaVersion: 1 });
  return { email, uid };
}

async function open(page: Page, email: string) {
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByRole("status").filter({ hasText: "Synced" })).toBeVisible();
}

/** A text already in the account, as another device would have saved it. */
async function seedText(request: APIRequestContext, uid: string, raw: string, at = new Date(), extra: Record<string, unknown> = {}): Promise<string> {
  const text = cleanText(raw);
  if (!text) throw new Error("empty text");
  const id = await textId(text);
  await writeDoc(request, `users/${uid}/saves/${id}`, { ...newText(text, { source: "paste", now: at }), ...extra });
  return id;
}

test("a text pasted on the phone shows up on the laptop by itself, where one tap copies it", async ({ page, context, browser, request }) => {
  const { email, uid } = await account(request);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, email);
  await expect(page.getByText("Nothing saved yet")).toBeVisible();

  const phoneContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const phone = await phoneContext.newPage();
  const phoneCsp = watchCsp(phone);
  await open(phone, email);
  await phone.getByRole("button", { name: "Add", exact: true }).click();
  await phone.getByLabel("Link or text").fill(`\n${CODE}  `);
  await phone.getByRole("button", { name: "Save text" }).click();
  await expect(phone.getByRole("dialog").getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(phone.getByRole("dialog").getByText("Synced to your library.")).toBeVisible();

  const id = await textId(CODE);
  expect(await saveDoc(request, uid, id)).toMatchObject({ text: CODE, platform: "text", source: "paste", status: "active", deleted: false });
  // A text has no link, and nothing to look up.
  expect(await saveDoc(request, uid, id)).not.toHaveProperty("url");

  // The laptop's library shows it without a reload, line break and all.
  await expect(card(page, id).locator("[data-saved-text]")).toHaveText(CODE, { useInnerText: true });
  await card(page, id).getByRole("button", { name: "Copy text" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Text copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);

  // The same text again, from the laptop: one document, not two.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Link or text").fill(CODE);
  await page.getByRole("button", { name: "Save text" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Already saved" })).toBeVisible();
  expect(await listDocs(request, `users/${uid}/saves`)).toEqual([id]);

  expect(phoneCsp).toEqual([]);
  await phoneContext.close();
});

test("text shared from another app is saved as a text; a link in a share still saves the post", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await open(page, email);

  // What Android sends for a selected piece of text: no link anywhere.
  await page.goto(share({ title: "Shopping", text: "milk, eggs\nbread" }));
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  await expect(page.locator("[data-saved-text]")).toHaveText("Shopping\nmilk, eggs\nbread", { useInnerText: true });
  await expect(page).toHaveURL(/\/share\/$/);
  const id = await textId("Shopping\nmilk, eggs\nbread");
  expect(await saveDoc(request, uid, id)).toMatchObject({ text: "Shopping\nmilk, eggs\nbread", platform: "text", source: "share-android" });

  // Tags and a note work as they do for a post.
  await page.getByLabel("Tags", { exact: true }).fill("Errands");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Note").fill("For Saturday");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect.poll(() => saveDoc(request, uid, id)).toMatchObject({ tags: ["errands"], note: "For Saturday" });

  await page.goto(share({ title: "Shopping", text: "milk, eggs\r\nbread" }));
  await expect(page.getByRole("heading", { name: "Already saved" })).toBeVisible();

  await page.goto(share({ title: "A reel", text: "Look! https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc" }));
  await expect(page.getByText("Instagram reel")).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  expect((await listDocs(request, `users/${uid}/saves`)).sort()).toEqual(["instagram_C8xYz12AbCd", id].sort());
});

test("a text shared while signed out waits on the device and is saved after sign-in", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await page.goto(share({ text: "Flight BA 284, seat 23A" }));
  await expect(page.getByRole("heading", { name: "Sign in to save this" })).toBeVisible();
  await expect(page.locator("[data-saved-text]")).toHaveText("Flight BA 284, seat 23A");
  await expect(page).toHaveURL(/\/share\/$/);

  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/save\/$/);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  expect(await saveDoc(request, uid, await textId("Flight BA 284, seat 23A"))).toMatchObject({ source: "share-android", platform: "text" });

  // It has left the waiting list.
  await page.goto("/save/");
  await expect(page.getByRole("heading", { name: "Save a post" })).toBeVisible();
});

test("in the library a text is searched, filtered, opened up, trashed and restored like any save", async ({ page, request }) => {
  const { email, uid } = await account(request);
  const link = parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  if (!link) throw new Error("parse failed");
  await writeDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`, newSave(link, { source: "web", now: new Date(2026, 8, 1) }));
  const long = Array.from({ length: 30 }, (_, i) => `Step ${i + 1}: tighten the bolt`).join("\n");
  const longId = await seedText(request, uid, long, new Date(2026, 8, 2));
  await open(page, email);
  await expect(cards(page)).toHaveCount(2);

  // Words with a link in them: the box asks which to save. As a text, its link can be opened.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Link or text").fill("Cabin wifi: pinecone42 (https://example.com/cabin).");
  await expect(page.getByRole("button", { name: "Save the link" })).toBeVisible();
  await page.getByRole("button", { name: "Save as text" }).click();
  await expect(page.getByRole("dialog").getByText("Synced to your library.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  const wifiId = await textId("Cabin wifi: pinecone42 (https://example.com/cabin).");
  await expect(cards(page)).toHaveCount(3);
  await expect(card(page, wifiId).getByRole("link", { name: "https://example.com/cabin" })).toHaveAttribute("href", "https://example.com/cabin");
  await expect(card(page, wifiId).getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");

  // Search reads the text; the Text chip shows only texts.
  await page.getByRole("searchbox").fill("pinecone");
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, wifiId)).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(page).toHaveURL(/platform=text/);
  await expect(cards(page)).toHaveCount(2);

  // A long text is folded (lines are hidden), with a button that shows the rest.
  const hidden = () => card(page, longId).locator("[data-saved-text]").evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(await hidden()).toBeGreaterThan(100);
  await card(page, longId).getByRole("button", { name: "Show all" }).click();
  await expect(card(page, longId).getByRole("button", { name: "Show less" })).toBeVisible();
  expect(await hidden()).toBe(0);

  // The list layout shows the first line, and still copies the whole text.
  await page.getByRole("button", { name: "list" }).click();
  await expect(card(page, longId).locator("[data-saved-text]")).toHaveText("Step 1: tighten the bolt");
  await expect(card(page, longId).getByRole("button", { name: "Copy text" })).toBeVisible();
  await page.getByRole("button", { name: "grid" }).click();

  // Favorite, trash and restore.
  await card(page, wifiId).getByRole("button", { name: "Add to favorites" }).click();
  await expect.poll(() => saveDoc(request, uid, wifiId)).toMatchObject({ favorite: true });
  await card(page, wifiId).getByRole("button", { name: "Actions for Text" }).click();
  await expect(page.getByRole("menuitem", { name: "Copy text" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open original" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect.poll(() => saveDoc(request, uid, wifiId)).toMatchObject({ status: "trashed" });
  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(card(page, wifiId)).toContainText("pinecone42");
  await expect(card(page, wifiId)).toContainText("In the Trash");
  await card(page, wifiId).getByRole("button", { name: "Actions for Text" }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect.poll(() => saveDoc(request, uid, wifiId)).toMatchObject({ status: "active", text: "Cabin wifi: pinecone42 (https://example.com/cabin)." });
});

test("pasting onto the library page opens the Add box with what was pasted", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await open(page, email);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Locker 17, combination 30-12-8");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  const dialog = page.getByRole("dialog", { name: "Add to your library" });
  await expect(dialog.getByLabel("Link or text")).toHaveValue("Locker 17, combination 30-12-8");
  // Ctrl+Enter saves from inside the box.
  await dialog.getByLabel("Link or text").press("Control+Enter");
  await expect(page.getByRole("dialog").getByText("Synced to your library.")).toBeVisible();
  expect(await saveDoc(request, uid, await textId("Locker 17, combination 30-12-8"))).toMatchObject({ platform: "text", source: "paste" });

  // A text over the limit is refused with the reason, not cut short.
  await page.getByRole("button", { name: "Add another" }).click();
  await page.getByLabel("Link or text").fill("x".repeat(10_001));
  await expect(page.getByRole("alert")).toContainText("up to 10,000 characters");
  await expect(page.getByRole("button", { name: "Save text" })).toBeDisabled();
});

test("a text saved offline waits on the device and syncs when the connection is back", async ({ page, context, request }) => {
  const { email, uid } = await account(request);
  await open(page, email);
  await page.goto("/save/");
  await expect(page.getByRole("heading", { name: "Save a post" })).toBeVisible();
  const id = await textId("Tunnel thought: call the plumber");

  await context.setOffline(true);
  await page.getByLabel("Link or text").fill("Tunnel thought: call the plumber");
  await page.getByRole("button", { name: "Save text" }).click();
  await expect(page.getByText("Saved on this device. It syncs when you're back online.")).toBeVisible();
  expect(await saveDoc(request, uid, id)).toBeNull();

  await context.setOffline(false);
  await expect(page.getByText("Synced to your library.")).toBeVisible({ timeout: 30_000 });
  expect(await saveDoc(request, uid, id)).toMatchObject({ text: "Tunnel thought: call the plumber", source: "paste" });
});

test("the JSON export carries texts, and importing it into another account brings them back", async ({ page, request, browser }) => {
  const { email, uid } = await account(request);
  await writeDoc(request, `users/${uid}/collections/Codes1`, { name: "Codes", order: 0, createdAt: new Date(), updatedAt: new Date(), deleted: false });
  const id = await seedText(request, uid, CODE, new Date(Date.UTC(2026, 5, 1)), { tags: ["home"], note: "Front gate", favorite: true, collectionIds: ["Codes1"] });
  await open(page, email);
  await expect(card(page, id)).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Export…" }).click();
  const started = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Everything (JSON)" }).click();
  const download = await started;
  const json = await readFile(await download.path(), "utf8");
  expect((JSON.parse(json) as { saves: unknown[] }).saves).toEqual([
    { text: CODE, platform: "text", note: "Front gate", tags: ["home"], collections: ["Codes"], favorite: true, status: "active", savedAt: "2026-06-01T00:00:00.000Z", source: "paste" },
  ]);

  const other = await account(request);
  const context = await browser.newContext();
  const page2 = await context.newPage();
  await context.route("http://127.0.0.1:8788/**", (route) => route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await open(page2, other.email);
  await page2.getByRole("button", { name: "Settings" }).click();
  await page2.getByRole("dialog").getByRole("button", { name: "Import…" }).click();
  await page2.getByLabel("File to import").setInputFiles({ name: "export.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await page2.getByRole("button", { name: "Import 1 post" }).click();
  await expect(page2.getByText("Import finished: 1 post added.")).toBeVisible();
  // The import's writes reach the server one after another: wait for the collection, then the text.
  await expect.poll(() => listDocs(request, `users/${other.uid}/collections`)).toHaveLength(1);
  const [collectionId] = await listDocs(request, `users/${other.uid}/collections`);
  await expect
    .poll(() => saveDoc(request, other.uid, id))
    .toMatchObject({ text: CODE, platform: "text", tags: ["home"], note: "Front gate", favorite: true, collectionIds: [collectionId], savedAt: "2026-06-01T00:00:00Z", source: "import-backup" });
  await expect(card(page2, id).locator("[data-saved-text]")).toHaveText(CODE, { useInnerText: true });
  await context.close();
});

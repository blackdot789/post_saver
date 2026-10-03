import type { APIRequestContext, Page } from "@playwright/test";
import { cleanText, newCategory, newSave, newText, parse, textId } from "@postsaver/core";
import { createUser, listDocs, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// Categories (CLAUDE.md §6.1 "As built: categories"): what kind of thing a save is. A ready-made
// one (Note, Quote, Command, Article, Blog) or one of the owner's own, with a symbol. It's chosen
// while saving or later, gets a tab beside the platforms, and syncs like everything else.

const COMMAND = "git stash -u && git pull --rebase";
const WIFI = "Cabin wifi: pinecone42";
const IG = "https://www.instagram.com/natgeo/reel/C8xYz12AbCd/";
const IG_ID = "instagram_C8xYz12AbCd";
const RECIPES = "Qx7Lm2Vt9KpRw4Zs8NbY";

const cards = (page: Page) => page.locator("[data-save-id]");
const card = (page: Page, id: string) => page.locator(`[data-save-id="${id}"]`);
const tabs = (page: Page) => page.getByRole("list", { name: "Platforms and categories" });
const tab = (page: Page, name: string) => tabs(page).getByRole("button", { name, exact: true });
const saveDoc = (request: APIRequestContext, uid: string, id: string) => readDoc(request, `users/${uid}/saves/${id}`);

async function account(request: APIRequestContext) {
  const email = uniqueEmail("cat");
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

async function seedText(request: APIRequestContext, uid: string, raw: string, at: Date, category?: string): Promise<string> {
  const text = cleanText(raw);
  if (!text) throw new Error("empty text");
  const id = await textId(text);
  await writeDoc(request, `users/${uid}/saves/${id}`, newText(text, { source: "paste", now: at, category }));
  return id;
}

async function seedPost(request: APIRequestContext, uid: string, at: Date, extra: Record<string, unknown> = {}) {
  const link = parse(IG);
  if (!link) throw new Error("no link");
  await writeDoc(request, `users/${uid}/saves/${IG_ID}`, { ...newSave(link, { source: "web", now: at }), ...extra });
}

const seedRecipes = (request: APIRequestContext, uid: string) =>
  writeDoc(request, `users/${uid}/categories/${RECIPES}`, newCategory({ name: "Recipes", symbol: "🍳", order: 0, now: new Date() }));

const day = (n: number) => new Date(2026, 8, n);

test("a text marked as a Command gets a tab of its own, leaves Text, and does so on every device", async ({ page, browser, request }) => {
  const { email, uid } = await account(request);
  const commandId = await seedText(request, uid, COMMAND, day(2));
  const wifiId = await seedText(request, uid, WIFI, day(1));
  await open(page, email);
  await expect(cards(page)).toHaveCount(2);
  await expect(tab(page, "Command")).toHaveCount(0);

  const laptopContext = await browser.newContext();
  const laptop = await laptopContext.newPage();
  await open(laptop, email);

  await card(page, commandId).getByRole("button", { name: "Actions for Text" }).click();
  await page.getByRole("menuitem", { name: "Category…" }).click();
  const dialog = page.getByRole("dialog", { name: "Category" });
  await expect(dialog.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  for (const name of ["Note", "Quote", "Command", "Article", "Blog"]) await expect(dialog.getByRole("button", { name, exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Command", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Command", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Close" }).click();

  // The card says what it is now, and the server has it.
  await expect(card(page, commandId).locator('[data-category="command"]')).toHaveText("⌨️Command");
  await expect(card(page, commandId).getByRole("button", { name: "Actions for Command" })).toBeVisible();
  await expect.poll(() => saveDoc(request, uid, commandId)).toMatchObject({ category: "command", text: COMMAND, platform: "text" });

  // Its own tab; the Text tab keeps only what has no category.
  await tab(page, "Command").click();
  await expect(page).toHaveURL(/\?category=command$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, commandId)).toBeVisible();
  await tab(page, "Text").click();
  await expect(page).toHaveURL(/\?platform=text$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, wifiId)).toBeVisible();
  await tab(page, "All").click();
  await expect(cards(page)).toHaveCount(2);

  // Search knows the category by name.
  await page.getByRole("searchbox").fill("command");
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, commandId)).toBeVisible();
  await page.getByRole("searchbox").fill("");

  // The other device shows the same, by itself.
  await expect(card(laptop, commandId).locator('[data-category="command"]')).toBeVisible();
  await expect(tab(laptop, "Command")).toBeVisible();

  // Back to no category: the tab goes, the text is a Text again.
  await card(page, commandId).getByRole("button", { name: "Actions for Command" }).click();
  await page.getByRole("menuitem", { name: "Category…" }).click();
  await page.getByRole("dialog", { name: "Category" }).getByRole("button", { name: "None" }).click();
  await page.getByRole("dialog", { name: "Category" }).getByRole("button", { name: "Close" }).click();
  await expect(tab(page, "Command")).toHaveCount(0);
  await expect(card(page, commandId).getByRole("button", { name: "Actions for Text" })).toBeVisible();
  await expect.poll(() => saveDoc(request, uid, commandId)).not.toHaveProperty("category");
  await expect(tab(laptop, "Command")).toHaveCount(0);
  await laptopContext.close();
});

test("a category of one's own is made while saving, with a name and a symbol", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await seedPost(request, uid, day(1));
  await open(page, email);

  await page.goto(`/share/?${new URLSearchParams({ text: "Carbonara: guanciale, eggs, pecorino, pepper. No cream." })}`);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Synced to your library.")).toBeVisible();
  const picker = page.getByRole("list", { name: "Categories" });
  await expect(picker.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Category name").fill("  Recipes ");
  await expect(page.getByRole("radio")).toHaveCount(40);
  await page.getByRole("radio", { name: "🍳" }).click();
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(picker.getByRole("button", { name: "Recipes", exact: true })).toHaveAttribute("aria-pressed", "true");

  const textSaveId = await textId("Carbonara: guanciale, eggs, pecorino, pepper. No cream.");
  await expect.poll(() => listDocs(request, `users/${uid}/categories`)).toHaveLength(1);
  const [categoryId] = await listDocs(request, `users/${uid}/categories`);
  expect(await readDoc(request, `users/${uid}/categories/${categoryId}`)).toMatchObject({ name: "Recipes", symbol: "🍳", order: 0, deleted: false });
  await expect.poll(() => saveDoc(request, uid, textSaveId)).toMatchObject({ category: categoryId, source: "share-android" });

  // In the library it has a tab with its symbol, and the card carries it.
  await page.goto("/app/");
  await expect(tab(page, "Recipes")).toHaveText("🍳Recipes");
  await expect(card(page, textSaveId).locator(`[data-category="${categoryId}"]`)).toHaveText("🍳Recipes");
  await expect(tab(page, "Text")).toHaveCount(0);

  // A post from an app can be in it too, and stays under its app's tab as well.
  await card(page, IG_ID).getByRole("button", { name: "Actions for Instagram reel" }).click();
  await page.getByRole("menuitem", { name: "Category…" }).click();
  await page.getByRole("dialog", { name: "Category" }).getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("dialog", { name: "Category" }).getByRole("button", { name: "Close" }).click();
  await expect.poll(() => saveDoc(request, uid, IG_ID)).toMatchObject({ category: categoryId, platform: "instagram" });
  await tab(page, "Recipes").click();
  await expect(cards(page)).toHaveCount(2);
  await tab(page, "Instagram").click();
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, IG_ID).locator(`[data-category="${categoryId}"]`)).toBeVisible();

  // The same name again picks the category that exists instead of making a twin.
  await tab(page, "New category").click();
  await page.getByLabel("Category name").fill("recipes");
  await expect(page.getByRole("button", { name: "Use Recipes" })).toBeVisible();
  await page.getByRole("button", { name: "Use Recipes" }).click();
  expect(await listDocs(request, `users/${uid}/categories`)).toHaveLength(1);
});

test("one's own category can be renamed, given another symbol, and deleted; its saves stay", async ({ page, request }) => {
  const { email, uid } = await account(request);
  await seedRecipes(request, uid);
  const id = await seedText(request, uid, "Carbonara: no cream", day(1), RECIPES);
  await open(page, email);

  // A new one from the tab row shows up as a tab at once, even while empty.
  await tab(page, "New category").click();
  await page.getByLabel("Category name").fill("Ideas");
  await page.getByRole("radio", { name: "💡" }).click();
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(tab(page, "Ideas")).toHaveText("💡Ideas");
  await expect.poll(() => listDocs(request, `users/${uid}/categories`)).toHaveLength(2);

  await tab(page, "Recipes").click();
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Edit category" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit category" });
  await expect(dialog.getByLabel("Category name")).toHaveValue("Recipes");
  await expect(dialog.getByRole("radio", { name: "🍳" })).toHaveAttribute("aria-checked", "true");
  // A name that another category has is refused.
  await dialog.getByLabel("Category name").fill("ideas");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await dialog.getByLabel("Category name").fill("Cooking");
  await dialog.getByRole("radio", { name: "☕" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(tab(page, "Cooking")).toHaveText("☕Cooking");
  await expect(card(page, id).locator(`[data-category="${RECIPES}"]`)).toHaveText("☕Cooking");
  await expect.poll(() => readDoc(request, `users/${uid}/categories/${RECIPES}`)).toMatchObject({ name: "Cooking", symbol: "☕" });

  // Ready-made categories have no "Edit".
  await tab(page, "All").click();
  await expect(page.getByRole("button", { name: "Edit category" })).toHaveCount(0);

  await tab(page, "Cooking").click();
  await page.getByRole("button", { name: "Edit category" }).click();
  await page.getByRole("button", { name: "Delete…" }).click();
  await expect(page.getByText("What's in it stays in your library")).toBeVisible();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(tab(page, "Cooking")).toHaveCount(0);
  // The text is still there, under Text again.
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(card(page, id).getByRole("button", { name: "Actions for Text" })).toBeVisible();
  await expect(tab(page, "Text")).toBeVisible();
  await expect.poll(() => readDoc(request, `users/${uid}/categories/${RECIPES}`)).toMatchObject({ deleted: true });
  expect(await saveDoc(request, uid, id)).toMatchObject({ status: "active", deleted: false });
});

test("several saves get a category at once", async ({ page, request }) => {
  const { email, uid } = await account(request);
  const a = await seedText(request, uid, "First thought", day(1));
  const b = await seedText(request, uid, "Second thought", day(2));
  await seedPost(request, uid, day(3));
  await open(page, email);

  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await page.getByRole("button", { name: "Set category" }).click();
  await page.getByRole("dialog", { name: "Set a category for 3 saves" }).getByRole("button", { name: "Note", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const id of [a, b, IG_ID]) await expect.poll(() => saveDoc(request, uid, id)).toMatchObject({ category: "note" });
  await page.getByRole("button", { name: "Cancel" }).click();
  await tab(page, "Note").click();
  await expect(cards(page)).toHaveCount(3);
});

test("the sync indicator is a green dot; it speaks only when there's something to know", async ({ page, context, request }) => {
  const { email } = await account(request);
  await open(page, email);
  const status = page.getByRole("status").filter({ hasText: /Synced|Offline/ });
  // "Synced" is there for screen readers and on hover, not on the screen.
  await expect(status.getByText("Synced")).toHaveClass(/sr-only/);
  await expect(status).toHaveAttribute("title", /^Synced\./);
  await context.setOffline(true);
  await expect(status.getByText("Offline")).toBeVisible();
  await expect(status.getByText("Offline")).not.toHaveClass(/sr-only/);
  await context.setOffline(false);
});

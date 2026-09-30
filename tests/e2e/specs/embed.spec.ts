import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse } from "@postsaver/core";
import { createUser, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// The embed sandbox and its host (CLAUDE.md §6.6, §11.8): previews render on the sandbox origin,
// the host trusts only that origin, and every failure becomes a link card with a reason.

const EMBED = "http://localhost:4174";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const TWEET = "https://x.com/someone/status/1234567890123456789";

function seed(request: APIRequestContext, uid: string, id: string, url: string, extra: Record<string, unknown> = {}) {
  const link = parse(url);
  if (!link) throw new Error(`parse failed for ${url}`);
  return writeDoc(request, `users/${uid}/saves/${id}`, { ...newSave(link, { source: "web", now: new Date() }), ...extra });
}

async function openLibrary(page: Page, request: APIRequestContext, previews: "always" | "click" = "always") {
  const email = uniqueEmail("embed");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, {
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: { previews },
    schemaVersion: 1,
  });
  return { email, uid };
}

/** A stub of X's widgets.js: `available` decides what createTweet resolves with. */
const widgetsStub = (available: boolean, height = 150) => `
  window.twttr = { widgets: { createTweet: async (id, el) => {
    if (!${available}) return undefined;
    const div = document.createElement("div"); div.textContent = "Tweet " + id; div.style.height = "${height}px"; el.append(div); return div;
  } } };`;

/** The part of a card that shows (and cuts) the preview. */
const shownPart = (page: Page, id: string) => page.locator(`[data-save-id="${id}"] [data-preview] > div`).first();
const heightOf = async (part: ReturnType<typeof shownPart>) => Math.round((await part.boundingBox())?.height ?? 0);

test("the sandbox alone shows nothing; inside the app it renders and reports height and status", async ({ page, request, context }) => {
  // Opened directly (no parent from the app): nothing to render.
  await page.goto(`${EMBED}/#p=youtube&id=dQw4w9WgXcQ`);
  await expect(page.getByText("This page shows post previews inside the app.")).toBeVisible();
  await expect(page.locator("iframe, .yt-facade")).toHaveCount(0);

  const { email, uid } = await openLibrary(page, request);
  await seed(request, uid, "youtube_dQw4w9WgXcQ", YT);
  await page.goto("/login/");
  await signIn(page, email);

  const frame = page.frameLocator('iframe[title="YouTube preview"]');
  await expect(frame.getByRole("button", { name: "Play video" })).toBeVisible();
  // The sandbox's reported height sized the iframe, and the verdict is "ok".
  await expect(page.locator("[data-preview=ok]")).toHaveCount(1);
  const height = await page.locator('iframe[title="YouTube preview"]').evaluate((el) => (el as HTMLIFrameElement).getBoundingClientRect().height);
  expect(height).toBeGreaterThan(150);
  expect(height).not.toBe(360);
  // Clicking the facade loads the player from youtube-nocookie.com.
  await context.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ status: 200, body: "<html></html>", contentType: "text/html" }));
  await frame.getByRole("button", { name: "Play video" }).click();
  await expect(frame.locator('iframe[title="YouTube video"]')).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test("a post the platform no longer has becomes a link card, and the verdict is recorded", async ({ page, request, context }) => {
  await context.route("https://platform.twitter.com/widgets.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: widgetsStub(false) }));
  const { email, uid } = await openLibrary(page, request);
  await seed(request, uid, "x_1234567890123456789", TWEET);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByText("This post is no longer available on the platform.")).toBeVisible();
  await expect.poll(() => readDoc(request, `users/${uid}/saves/x_1234567890123456789`)).toMatchObject({ embedStatus: "unavailable" });
  // The Unavailable view lists it.
  await page.getByRole("button", { name: "Unavailable" }).click();
  await expect(page.getByRole("list", { name: "Saves" })).toContainText("X");
});

test("a blocked platform script (an ad-blocker) becomes a link card with a reason and a retry", async ({ page, request, context }) => {
  await context.route("https://platform.twitter.com/widgets.js", (r) => r.abort());
  const { email, uid } = await openLibrary(page, request);
  await seed(request, uid, "x_1234567890123456789", TWEET);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByText("The preview was blocked, most likely by an ad-blocker or a network filter.")).toBeVisible();
  // Not a verdict about the post itself: nothing is recorded.
  expect(await readDoc(request, `users/${uid}/saves/x_1234567890123456789`)).toMatchObject({ embedStatus: "unknown" });

  // The blocker is gone: Try again renders the post.
  await context.unroute("https://platform.twitter.com/widgets.js");
  await context.route("https://platform.twitter.com/widgets.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: widgetsStub(true) }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.frameLocator('iframe[title="X preview"]').getByText("Tweet 1234567890123456789")).toBeVisible();
});

test("the host ignores messages that don't come from the sandbox", async ({ page, request }) => {
  const { email, uid } = await openLibrary(page, request);
  await seed(request, uid, "youtube_dQw4w9WgXcQ", YT);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.locator("[data-preview=ok]")).toHaveCount(1);
  // A message from the page itself (the app's own origin) claiming the post is unavailable.
  await page.evaluate(() => window.postMessage({ type: "ps:status", status: "unavailable" }, "*"));
  await page.evaluate(() => window.postMessage({ type: "ps:height", height: 3000 }, "*"));
  await page.waitForTimeout(500);
  await expect(page.locator("[data-preview=ok]")).toHaveCount(1);
  const height = await page.locator('iframe[title="YouTube preview"]').evaluate((el) => (el as HTMLIFrameElement).getBoundingClientRect().height);
  expect(height).toBeLessThan(1000);
  expect(await readDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`)).toMatchObject({ embedStatus: "unknown" });
});

test("previews wait for consent, and 'only when I tap' shows a button per post", async ({ page, request }) => {
  const email = uniqueEmail("consent");
  const uid = await createUser(request, email, true);
  await seed(request, uid, "youtube_dQw4w9WgXcQ", YT);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByText("Show previews of your saved posts?")).toBeVisible();
  await expect(page.locator("iframe[title$='preview']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show preview", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Only when I tap" }).click();
  await expect(page.getByText("Show previews of your saved posts?")).toHaveCount(0);
  await expect.poll(() => readDoc(request, `users/${uid}`)).toMatchObject({ settings: { previews: "click" } });
  await page.getByRole("button", { name: "Show preview", exact: true }).click();
  await expect(page.locator("[data-preview=ok]")).toHaveCount(1);

  // Switched to "always" in Settings: the next visit loads previews by itself.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Always show").check();
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page.locator("[data-preview=ok]")).toHaveCount(1);
});

test("a platform switched off remotely shows link cards instead", async ({ page, request }) => {
  const { email, uid } = await openLibrary(page, request);
  await seed(request, uid, "youtube_dQw4w9WgXcQ", YT);
  await writeDoc(request, "config/app", { disabledEmbeds: ["youtube"] });
  try {
    await page.goto("/login/");
    await signIn(page, email);
    await expect(page.getByText("Previews from YouTube are turned off for now.")).toBeVisible();
    await expect(page.locator("iframe[title$='preview']")).toHaveCount(0);
  } finally {
    await writeDoc(request, "config/app", { disabledEmbeds: [] });
  }
});

test("more previews than loading slots: every one still loads", async ({ page, request }) => {
  const { email, uid } = await openLibrary(page, request);
  // Five saves, three loading slots: a slot must be handed on once its preview has loaded.
  const ids = ["dQw4w9WgXcQ", "aqz-KE-bpKQ", "jNQXAC9IVRw", "9bZkp7q19f0", "kJQP7kiw5Fk"];
  for (const id of ids) await seed(request, uid, `youtube_${id}`, `https://www.youtube.com/watch?v=${id}`);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.locator("[data-preview=ok]")).toHaveCount(ids.length);
});

test("a tall post is cut at the card's limit, and 'Show full post' opens it", async ({ page, request, context }) => {
  await context.route("https://platform.twitter.com/widgets.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: widgetsStub(true, 1200) }));
  const { email, uid } = await openLibrary(page, request);
  const id = "x_1234567890123456789";
  await seed(request, uid, id, TWEET);
  await page.goto("/login/");
  await signIn(page, email);

  const holder = page.locator(`[data-save-id="${id}"] [data-preview]`);
  await expect(holder).toHaveAttribute("data-cut", "folded");
  // The limit: a 4:5 post under a 54 px header strip, for a card this wide.
  const width = Math.round((await holder.boundingBox())?.width ?? 0);
  await expect.poll(() => heightOf(shownPart(page, id))).toBe(Math.round(width * 1.25) + 54);

  await page.getByRole("button", { name: "Show full post" }).click();
  await expect(holder).toHaveAttribute("data-cut", "open");
  await expect.poll(() => heightOf(shownPart(page, id))).toBe(1200);
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(holder).toHaveAttribute("data-cut", "folded");
});

test("an Instagram post is folded at the end of its media", async ({ page, request, context }) => {
  // Instagram's embed page reports its height; the 154 px under the media (likes, "Add a comment…") are folded away.
  await context.route("https://www.instagram.com/p/*/embed/", (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<body style="margin:0;background:#fff">Post<script>parent.postMessage(JSON.stringify({ type: "MEASURE", details: { height: 560 } }), "*")</script></body>`,
    }),
  );
  const { email, uid } = await openLibrary(page, request);
  const id = "instagram_C8xYz12AbCd";
  await seed(request, uid, id, "https://www.instagram.com/reel/C8xYz12AbCd/");
  await page.goto("/login/");
  await signIn(page, email);

  const holder = page.locator(`[data-save-id="${id}"] [data-preview]`);
  await expect(holder).toHaveAttribute("data-preview", "ok");
  await expect(holder).toHaveAttribute("data-cut", "folded");
  await expect.poll(() => heightOf(shownPart(page, id))).toBe(560 - 154);
  await page.getByRole("button", { name: "Show full post" }).click();
  await expect.poll(() => heightOf(shownPart(page, id))).toBe(560);
});

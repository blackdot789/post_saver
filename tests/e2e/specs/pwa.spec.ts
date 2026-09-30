import type { APIRequestContext, Page } from "@playwright/test";
import { newSave, parse } from "@postsaver/core";
import { createUser, readDoc, uniqueEmail, writeDoc } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// The installable app (CLAUDE.md §6.1, §11): the manifest that puts it in Android's Share menu,
// and the service worker that lets its pages open without a connection.

// Every other spec blocks service workers; these tests are about it.
test.use({ serviceWorkers: "allow" });

const IG_SHARE = "Check out this reel! https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** A verified account with one save, signed in, with the service worker in charge of the page. */
async function installed(page: Page, request: APIRequestContext) {
  const email = uniqueEmail("pwa");
  const uid = await createUser(request, email, true);
  await writeDoc(request, `users/${uid}`, { email, createdAt: new Date(), updatedAt: new Date(), settings: { previews: "click" }, schemaVersion: 1 });
  const link = parse(YT);
  if (!link) throw new Error("parse failed");
  await writeDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`, { ...newSave(link, { source: "web", now: new Date() }), title: "Never Gonna Give You Up" });
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.locator("[data-save-id]")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "Synced" })).toBeVisible();
  // The first visit installs it; it keeps every page by the time it's "ready".
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error("no active service worker");
  });
  return { uid };
}

test("the manifest makes the app installable and a share target; the service worker keeps its pages", async ({ request }) => {
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as Record<string, unknown>;
  expect(manifest).toMatchObject({
    id: "/",
    start_url: "/app/",
    display: "standalone",
    share_target: { action: "/share/", method: "GET", params: { title: "title", text: "text", url: "url" } },
  });
  expect((manifest.icons as Array<{ sizes: string }>).map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  const worker = await request.get("/sw.js");
  expect(worker.headers()["content-type"]).toMatch(/javascript/);
  const source = await worker.text();
  expect(source).not.toMatch(/__(VERSION|FILES|PAGES)__;/);
  for (const page of ["/app/", "/login/", "/save/", "/share/", "/setup/"]) expect(source).toContain(`"${page}"`);
  // The landing page is never kept: it always comes from the network.
  expect(source).not.toMatch(/"\/",|"\/index\.html"/);
});

test("without a connection the library still opens, from the copies on the device", async ({ page, request, context }) => {
  await installed(page, request);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("[data-save-id]")).toHaveCount(1);
  await expect(page.locator("[data-save-id]")).toContainText("Never Gonna Give You Up");
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  // Other pages of the app open too, even ones this device never visited.
  await page.goto("/setup/?device=desktop");
  await expect(page.getByRole("heading", { name: "Set up saving" })).toBeVisible();
});

test("a post shared without a connection is saved on the device and syncs later", async ({ page, request, context }) => {
  const { uid } = await installed(page, request);
  await context.setOffline(true);
  await page.goto(`/share/?${new URLSearchParams({ text: IG_SHARE })}`);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByText("Saved on this device. It syncs when you're back online.")).toBeVisible();
  expect(await readDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`)).toBeNull();

  // Closed and opened again, still offline: the save is in the library, waiting.
  await page.goto("/app/");
  await expect(page.locator('[data-save-id="instagram_C8xYz12AbCd"]')).toBeVisible();

  await context.setOffline(false);
  await expect.poll(() => readDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`), { timeout: 20_000 }).toMatchObject({ source: "share-android", platform: "instagram" });
});

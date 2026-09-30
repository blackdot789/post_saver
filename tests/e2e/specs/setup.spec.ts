import type { APIRequestContext, Page } from "@playwright/test";
import { createUser, readDoc, uniqueEmail } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

// /setup/ (CLAUDE.md §6.1): installing on Android, the bookmarklet on a computer, and the live
// test that ends both.

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; CPH2709) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_INSTAGRAM = "Mozilla/5.0 (Linux; Android 15; CPH2709; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android";
const IG_SHARE = "Check out this reel! https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function signedInAt(page: Page, request: APIRequestContext, path: string) {
  const email = uniqueEmail("setup");
  const uid = await createUser(request, email, true);
  await page.goto(path);
  await signIn(page, email);
  return { email, uid };
}

const step = (page: Page, n: number) => page.locator(`[data-step="${n}"]`);

test("the setup guide needs an account, and comes back after sign-in", async ({ page, request }) => {
  await page.goto("/setup/?device=desktop");
  await expect(page).toHaveURL(/\/login\/\?next=%2Fsetup%2F%3Fdevice%3Ddesktop$/);
  const email = uniqueEmail("setup");
  await createUser(request, email, true);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/setup\/\?device=desktop$/);
  await expect(page.getByRole("heading", { name: "Set up saving" })).toBeVisible();
});

test("on a computer: the Save bookmark, and the live test when it's used on a post", async ({ page, request, context }) => {
  const { uid } = await signedInAt(page, request, "/setup/");
  await expect(page.getByRole("heading", { name: "Add the Save button to your browser" })).toBeVisible();
  const bookmark = page.locator("a[data-bookmarklet]");
  const href = (await bookmark.getAttribute("href")) ?? "";
  expect(href).toMatch(/^javascript:/);
  // Clicked on the setup page itself, it explains where it belongs instead of running.
  await bookmark.click();
  await expect(page.getByText("Don't click it here: drag it up to your bookmarks bar.")).toBeVisible();
  await expect(page).toHaveURL(/\/setup\/$/);
  await expect(page.getByText("Waiting for your post…")).toBeVisible();

  // The bookmark, clicked on a YouTube video in another tab.
  await context.route("https://www.youtube.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>A video</title>" }));
  const video = await context.newPage();
  await video.goto(YT);
  const popupOpens = video.waitForEvent("popup");
  await video.evaluate(decodeURIComponent(href.slice("javascript:".length)));
  const popup = await popupOpens;
  await expect(popup).toHaveURL(/\/save\//);
  expect(popup.viewportSize()).toEqual({ width: 420, height: 560 });
  await popup.waitForEvent("close");

  await expect.poll(() => readDoc(request, `users/${uid}/saves/youtube_dQw4w9WgXcQ`)).toMatchObject({ url: YT, source: "bookmarklet" });
  await expect(page.getByText("It works!")).toBeVisible();
  await expect(page.getByText("Your YouTube video is in your library.")).toBeVisible();
  await expect(step(page, 3)).toHaveAttribute("data-done", "true");
});

test.describe("on an Android phone", () => {
  test.use({ userAgent: ANDROID_CHROME, viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test("install from the button, share a post, and the live test sees it", async ({ page, request, context }) => {
    const { uid } = await signedInAt(page, request, "/setup/");
    // Until Chrome offers to install, the guide says where the menu item is.
    await expect(step(page, 1)).toContainText("Add to Home screen");

    await page.evaluate(() => {
      const offer = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: () => {
          document.body.dataset.prompted = "yes";
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(offer);
    });
    await page.getByRole("button", { name: /^Install / }).click();
    await expect(page.locator("body")).toHaveAttribute("data-prompted", "yes");
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(step(page, 1)).toHaveAttribute("data-done", "true");
    await expect(step(page, 1)).toContainText("Installed.");
    // Remembered on this device.
    await page.reload();
    await expect(step(page, 1)).toHaveAttribute("data-done", "true");
    await expect(page.getByText("Waiting for your post…")).toBeVisible();

    // A post shared from Instagram opens the share target (here: in another tab).
    const shared = await context.newPage();
    await shared.goto(`/share/?${new URLSearchParams({ text: IG_SHARE })}`);
    await expect(shared.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
    await expect.poll(() => readDoc(request, `users/${uid}/saves/instagram_C8xYz12AbCd`)).toMatchObject({ source: "share-android" });

    await expect(page.getByText("It works!")).toBeVisible();
    await expect(page.getByText("Your Instagram reel is in your library.")).toBeVisible();
    await expect(step(page, 2)).toHaveAttribute("data-done", "true");
  });

  test("the guide can be switched to another device", async ({ page, request }) => {
    await signedInAt(page, request, "/setup/");
    await expect(page.getByRole("button", { name: "Android" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Computer" }).click();
    await expect(page).toHaveURL(/\/setup\/\?device=desktop$/);
    await expect(page.locator("a[data-bookmarklet]")).toBeVisible();
    await page.getByRole("button", { name: "iPhone" }).click();
    await expect(page.getByText("The iPhone share button is coming soon.")).toBeVisible();
  });
});

test.describe("inside Instagram's built-in browser", () => {
  test.use({ userAgent: ANDROID_INSTAGRAM, viewport: { width: 412, height: 915 } });

  test("the guide sends people to Chrome, where installing works", async ({ page, request }) => {
    await signedInAt(page, request, "/setup/");
    await expect(step(page, 1)).toContainText("Instagram's own browser");
    await expect(page.getByRole("link", { name: "Open in Chrome" })).toHaveAttribute("href", /^intent:\/\/localhost:4173\/setup\/#Intent;scheme=http;package=com\.android\.chrome;/);
  });
});

test("the empty library points to the setup guide", async ({ page, request }) => {
  await signedInAt(page, request, "/login/");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
  await page.getByRole("link", { name: "Set up saving" }).click();
  await expect(page).toHaveURL(/\/setup\/$/);
});

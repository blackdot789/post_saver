import { PASSWORD, createUser, emailLink, uniqueEmail } from "./emulator.ts";
import { expect, signIn, test } from "./fixtures.ts";

const INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; CPH2621 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.37.109 Android (34/14; 450dpi; 1080x2412; OnePlus)";

test("the sign-in page is built with the site's security policy", async ({ page }) => {
  await page.goto("/login/");
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("email sign-up: blocked until the address is verified, then the library opens", async ({ page, request }) => {
  const email = uniqueEmail("signup");
  await page.goto("/login/?mode=signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("button", { name: /Send again in \d+s/ })).toBeDisabled();

  await page.getByRole("button", { name: "I've verified it" }).click();
  await expect(page.getByText("Not verified yet")).toBeVisible();

  // Open the emailed link, as the user would from their inbox.
  const link = await emailLink(request, email, "VERIFY_EMAIL");
  expect(link, "a verification email was sent").toBeTruthy();
  await request.get(link!);

  await page.getByRole("button", { name: "I've verified it" }).click();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

test("an unverified account that signs in is asked to verify", async ({ page, request }) => {
  const email = uniqueEmail("unverified");
  await createUser(request, email, false);
  await page.goto("/login/");
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different account" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("a wrong password gets a clear message", async ({ page, request }) => {
  const email = uniqueEmail("wrong");
  await createUser(request, email, true);
  await page.goto("/login/");
  await signIn(page, email, "not the password");
  await expect(page.getByRole("alert")).toContainText("don't match");
});

test("the library sends visitors to sign in and back, and sign-out returns to sign-in", async ({ page, request }) => {
  const email = uniqueEmail("next");
  await createUser(request, email, true);
  await page.goto("/app/");
  await expect(page).toHaveURL(/\/login\/\?next=%2Fapp%2F$/);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/app\/$/);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog").getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\//);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("a crafted link can't send people to another site after sign-in", async ({ page, request }) => {
  const email = uniqueEmail("evil");
  await createUser(request, email, true);
  await page.goto("/login/?next=//evil.example/");
  await signIn(page, email);
  await expect(page).toHaveURL("/app/");
});

test("password reset sends a link without revealing whether the account exists", async ({ page, request }) => {
  const email = uniqueEmail("reset");
  await createUser(request, email, true);
  await page.goto("/login/");
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(`If there's an account for ${email}`);
  expect(await emailLink(request, email, "PASSWORD_RESET"), "a reset email was sent").toBeTruthy();

  // Same message for an address with no account.
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If there's an account for");
});

test.describe("inside Instagram's built-in browser", () => {
  test.use({ userAgent: INSTAGRAM_ANDROID });

  test("Google is switched off, with a way out to Chrome, and email still works", async ({ page, request }) => {
    await page.goto("/login/");
    await expect(page.getByText("Google sign-in doesn't work inside Instagram")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Open in Chrome" })).toHaveAttribute(
      "href",
      /^intent:\/\/localhost:4173\/login\/#Intent;scheme=http;package=com\.android\.chrome;/,
    );

    const email = uniqueEmail("instagram");
    await createUser(request, email, true);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/app\/$/);
  });
});

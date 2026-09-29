import { expect, test as base, type Page } from "@playwright/test";
import { PASSWORD } from "./emulator.ts";

/** Collects Content-Security-Policy violations from a page's console. */
export function watchCsp(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) errors.push(msg.text());
  });
  return errors;
}

/** Every test also fails if the page broke a Content-Security-Policy rule. */
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ page }, use) => {
      const errors = watchCsp(page);
      await use();
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

import { expect, test as base, type BrowserContext, type Page, type Request } from "@playwright/test";
import type { BatchItem, BatchResult } from "@postsaver/core";
import { PASSWORD } from "./emulator.ts";

/** Where the e2e build looks for the resolver Worker (apps/web/.env.e2e). Nothing listens there. */
export const WORKER = "http://127.0.0.1:8788";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Stands in for the resolver Worker: `answer` gets the items of each POST /batch and returns
 * the results, or a status code to fail the whole call with.
 */
export async function stubWorker(context: BrowserContext, answer: (items: BatchItem[], request: Request) => BatchResult[] | number): Promise<void> {
  await context.route(`${WORKER}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const items = ((request.postDataJSON() as { items?: BatchItem[] } | null)?.items ?? []) as BatchItem[];
    const out = answer(items, request);
    if (typeof out === "number") return route.fulfill({ status: out, headers: CORS, json: { error: "stub" } });
    return route.fulfill({ status: 200, headers: CORS, json: { results: out } });
  });
}

/** Collects Content-Security-Policy violations from a page's console. */
export function watchCsp(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) errors.push(msg.text());
  });
  return errors;
}

/**
 * Every test also fails if the page broke a Content-Security-Policy rule. And no test reaches
 * the real Worker: unless a test stubs it, it's "down" (the app then just tries again later).
 */
export const test = base.extend<{ cspGuard: void; workerDown: void }>({
  workerDown: [
    async ({ context }, use) => {
      await stubWorker(context, () => 503);
      await use();
    },
    { auto: true },
  ],
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

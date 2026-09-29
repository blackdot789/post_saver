import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Runs inside `firebase emulators:exec` (see package.json), against a production build of the web
// app made with `--mode e2e` (apps/web/dist-e2e): same pages and CSP as the live site, but talking
// only to the local emulators. Uses the Chrome that's already installed (locally and on GitHub's
// runners).
export default defineConfig({
  testDir: "./specs",
  // One shared emulator; tests use unique emails, but run one at a time to keep failures readable.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  // The test:e2e script builds dist-e2e first. Vite is started directly (not through pnpm) so
  // Playwright can stop it when the run ends.
  webServer: {
    command: `./node_modules/.bin/vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
    cwd: "../../apps/web",
    url: `http://localhost:${PORT}/login/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

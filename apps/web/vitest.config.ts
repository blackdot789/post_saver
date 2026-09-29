import { defineConfig } from "vitest/config";

// Unit tests for the app's pure logic. Kept apart from vite.config.ts so tests don't load the
// site plugins (Tailwind, React, the config plugin).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

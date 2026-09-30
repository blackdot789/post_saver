import { defineConfig } from "vitest/config";

// The Worker's logic runs here in Node with a fake `fetch`: nothing contacts a real site.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});

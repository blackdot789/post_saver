import { defineConfig } from "vitest/config";

// Runs inside `firebase emulators:exec`, which starts the Firestore emulator and sets
// FIRESTORE_EMULATOR_HOST. One emulator is shared, so test files must not run in parallel.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});

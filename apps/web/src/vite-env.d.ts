/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "dev", "prod" or "demo" (emulator-only). Defaults to prod in production builds, dev otherwise. */
  readonly VITE_FIREBASE_ENV?: string;
  /** "1" to talk to the local Firebase emulators instead of a real project. */
  readonly VITE_EMULATORS?: string;
  /** The embed sandbox's origin when it isn't embed.<domain> (end-to-end test builds). */
  readonly VITE_EMBED_ORIGIN?: string;
}

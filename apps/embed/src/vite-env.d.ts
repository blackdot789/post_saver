/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** An extra allowed parent origin (the main app's preview server in end-to-end test builds). */
  readonly VITE_PARENT_ORIGIN?: string;
}

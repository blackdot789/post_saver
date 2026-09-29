import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { firebaseConfig } from "@postsaver/config";

type Env = "dev" | "prod" | "demo";

const requested = import.meta.env.VITE_FIREBASE_ENV;
/** Which Firebase project this build talks to: prod for production builds, dev otherwise. */
export const firebaseEnv: Env =
  requested === "dev" || requested === "prod" || requested === "demo" ? requested : import.meta.env.PROD ? "prod" : "dev";

/** True in end-to-end test builds, which use the local emulators. */
export const useEmulators = import.meta.env.VITE_EMULATORS === "1";

// A "demo-" project only exists in the emulators, so a test build can never touch real data.
const DEMO: FirebaseOptions = {
  apiKey: "demo-api-key",
  projectId: "demo-post-saver",
  appId: "1:0:web:0",
  authDomain: "127.0.0.1",
};

let app: FirebaseApp | undefined;

export function firebaseApp(): FirebaseApp {
  if (!app) {
    const options = firebaseEnv === "demo" ? DEMO : firebaseConfig(firebaseEnv);
    if (!options) throw new Error(`No Firebase config for "${firebaseEnv}" in site.config.ts`);
    app = initializeApp(options);
  }
  return app;
}

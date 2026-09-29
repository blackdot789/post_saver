import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getRedirectResult,
  indexedDBLocalPersistence,
  initializeAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { firebaseApp, useEmulators } from "../lib/firebase.ts";
import { writeLocal } from "../lib/storage.ts";
import { googleFlow, type BrowserEnv } from "./environment.ts";

export const MIN_PASSWORD_LENGTH = 8;
const REDIRECT_FLAG = "ps:google-redirect";

let auth: Auth | undefined;

/**
 * The shared Auth instance. The popup/redirect helper is passed only to the calls that need it,
 * so pages that never show Google sign-in (like /save/) don't load Google's iframe script.
 */
export function getAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(firebaseApp(), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    auth.useDeviceLanguage();
    if (useEmulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

/** Signs in with Google. "redirecting" means the page is about to leave and come back. */
export async function signInWithGoogle(env: BrowserEnv): Promise<"done" | "redirecting" | "cancelled"> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const flow = googleFlow(env);
  if (flow === "blocked") throw Object.assign(new Error("Google sign-in is blocked here"), { code: "app/in-app-browser" });

  const redirect = async () => {
    sessionStorage.setItem(REDIRECT_FLAG, "1");
    await signInWithRedirect(getAuth(), provider, browserPopupRedirectResolver);
    return "redirecting" as const;
  };
  if (flow === "redirect") return redirect();
  try {
    await signInWithPopup(getAuth(), provider, browserPopupRedirectResolver);
    return "done";
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked") return redirect();
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "cancelled";
    throw error;
  }
}

/** Finishes a Google redirect sign-in, if this page load is the return from one. */
export async function completeGoogleRedirect(): Promise<void> {
  if (!sessionStorage.getItem(REDIRECT_FLAG)) return;
  sessionStorage.removeItem(REDIRECT_FLAG);
  await getRedirectResult(getAuth(), browserPopupRedirectResolver);
}

/** Where email links (verify, reset) send people back to. */
function continueUrl(query: string): string {
  return `${location.origin}/login/${query}`;
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
  await sendVerification(user);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getAuth(), email.trim(), password);
}

/** When the last verification email was sent (ms), for the "send again" cooldown. */
export const VERIFY_SENT_KEY = "ps:verify-sent-at";

export async function sendVerification(user: User | null = getAuth().currentUser): Promise<void> {
  if (!user) return;
  await sendEmailVerification(user, { url: continueUrl("?verified=1") });
  writeLocal(VERIFY_SENT_KEY, String(Date.now()));
}

/**
 * Succeeds whether or not an account has that email, so the page never reveals who has an
 * account. (Email enumeration protection does the same on the server; this doesn't rely on it.)
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getAuth(), email.trim(), { url: continueUrl("?reset=1") });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
}

/**
 * Checks whether the email was verified (maybe on another device). When it was, refreshes the
 * ID token so its email_verified claim, which the database rules check, is true as well.
 */
export async function refreshVerified(): Promise<boolean> {
  const user = getAuth().currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
}

import { site } from "@postsaver/config";

/** Errors the user caused by closing a window; nothing to show. */
const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

const MESSAGES = new Map<string, string>([
  // With email enumeration protection on, a wrong email and a wrong password look the same.
  ["auth/invalid-credential", "That email and password don't match. Try again, or reset your password."],
  ["auth/invalid-login-credentials", "That email and password don't match. Try again, or reset your password."],
  ["auth/wrong-password", "That email and password don't match. Try again, or reset your password."],
  ["auth/user-not-found", "That email and password don't match. Try again, or reset your password."],
  ["auth/email-already-in-use", "There's already an account with this email. Sign in instead."],
  ["auth/invalid-email", "That email address doesn't look right."],
  ["auth/missing-email", "Enter your email address."],
  ["auth/missing-password", "Enter your password."],
  ["auth/weak-password", "Use a password of at least 8 characters."],
  ["auth/password-does-not-meet-requirements", "Use a password of at least 8 characters."],
  ["auth/too-many-requests", "Too many attempts. Wait a few minutes, then try again."],
  ["auth/network-request-failed", "You seem to be offline. Check your connection and try again."],
  [
    "auth/account-exists-with-different-credential",
    "This email already has an account with a password. Sign in with your email and password.",
  ],
  ["auth/user-disabled", `This account is disabled. Contact ${site.contact.support} for help.`],
  ["auth/popup-blocked", "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."],
  [
    "auth/web-storage-unsupported",
    "Your browser is blocking the storage sign-in needs. Leave private mode or allow site data, then try again.",
  ],
  ["auth/unauthorized-domain", "Sign-in isn't set up for this web address yet."],
  ["auth/operation-not-allowed", "This way of signing in isn't turned on yet."],
  ["auth/requires-recent-login", "For your security, sign in again to do this."],
  ["auth/expired-action-code", "That link has expired. Ask for a new one."],
  ["auth/invalid-action-code", "That link was already used or is broken. Ask for a new one."],
  [
    "app/in-app-browser",
    "Google sign-in doesn't work inside this app's browser. Open the page in Chrome or Safari, or use your email.",
  ],
]);

function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

/** What to tell the user about a failed sign-in step, or null when there's nothing to say. */
export function authErrorMessage(error: unknown): string | null {
  const code = codeOf(error);
  if (code && SILENT.has(code)) return null;
  const message = code && MESSAGES.get(code);
  if (message) return message;
  return `Something went wrong. Please try again.${code ? ` (${code})` : ""}`;
}

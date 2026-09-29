import { errorCode } from "../../data/firestore.ts";

const MESSAGES = new Map<string, string>([
  ["permission-denied", "Your account can't save right now. Sign out, sign in again, then try once more."],
  ["unauthenticated", "You're signed out. Sign in again, then try once more."],
  ["resource-exhausted", "Saving is paused until tomorrow because the service reached its daily limit. Sorry!"],
  ["invalid-argument", "This link can't be saved."],
]);

/** A plain sentence for a failed save or edit; unknown codes show in brackets for support. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  return (code && MESSAGES.get(code)) ?? `Something went wrong${code ? ` (${code})` : ""}. Please try again.`;
}

import type { APIRequestContext } from "@playwright/test";

// Helpers that talk to the Firebase Auth emulator's REST API directly, standing in for the
// user's inbox and for an admin.
const AUTH = "http://127.0.0.1:9099";
const PROJECT = "demo-post-saver";
const API_KEY = "demo-api-key";

export const PASSWORD = "correct horse battery";

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Creates an email/password account, optionally already verified. */
export async function createUser(request: APIRequestContext, email: string, verified: boolean): Promise<void> {
  const res = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    data: { email, password: PASSWORD, returnSecureToken: true },
  });
  const { localId } = (await res.json()) as { localId: string };
  if (verified) {
    await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
      headers: { Authorization: "Bearer owner" },
      data: { localId, emailVerified: true },
    });
  }
}

interface OobCode {
  email: string;
  requestType: "VERIFY_EMAIL" | "PASSWORD_RESET" | string;
  oobLink: string;
}

/** The link from the latest email of this type the emulator "sent" to this address. */
export async function emailLink(
  request: APIRequestContext,
  email: string,
  type: "VERIFY_EMAIL" | "PASSWORD_RESET",
): Promise<string | undefined> {
  const res = await request.get(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  return oobCodes.filter((c) => c.email === email && c.requestType === type).at(-1)?.oobLink;
}

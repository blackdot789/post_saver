import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { site } from "@postsaver/config";

// Who is calling (CLAUDE.md §6.3): every request carries the Firebase ID token of a signed-in
// user, checked against Google's public keys. No secrets live in the Worker.

const GOOGLE_KEYS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ISSUER = "https://securetoken.google.com/";

/** The Firebase projects whose users may call: dev (localhost) and prod. */
export const PROJECT_IDS: readonly string[] = [site.firebase.dev?.projectId, site.firebase.prod?.projectId].filter((id): id is string => !!id);

export interface Caller {
  uid: string;
  emailVerified: boolean;
}

let googleKeys: JWTVerifyGetKey | undefined;

/**
 * The caller behind an ID token, or null when the token isn't a valid, unexpired token of one
 * of our projects. `keys` and `projectIds` are replaced in tests.
 */
export async function verifyIdToken(token: string, keys?: JWTVerifyGetKey, projectIds: readonly string[] = PROJECT_IDS): Promise<Caller | null> {
  // Fetched once per Worker instance and cached by jose (Google rotates them every few days).
  keys ??= googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_KEYS));
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      audience: [...projectIds],
      issuer: projectIds.map((id) => ISSUER + id),
    });
    const audience = typeof payload.aud === "string" ? payload.aud : undefined;
    // The token must be issued by the very project it is for.
    if (!audience || payload.iss !== ISSUER + audience) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.auth_time === "number" && payload.auth_time > Date.now() / 1000 + 300) return null;
    return { uid: payload.sub, emailVerified: payload.email_verified === true };
  } catch {
    return null;
  }
}

/** The token from an `Authorization: Bearer …` header. */
export function bearer(request: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  return m?.[1] ?? null;
}

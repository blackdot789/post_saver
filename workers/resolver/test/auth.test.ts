import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { bearer, verifyIdToken } from "../src/auth.ts";

// Tokens signed with a key made here, checked against a key set made from it: the same checks
// the Worker runs against Google's keys.

const PROJECTS = ["proj-dev", "proj-prod"];
let keys: ReturnType<typeof createLocalJWKSet>;
let sign: (claims: JWTPayload, options?: { expired?: boolean; key?: CryptoKey }) => Promise<string>;
let strangerKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  strangerKey = (await generateKeyPair("RS256")).privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] });
  sign = (claims, { expired = false, key = pair.privateKey } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ auth_time: now - 60, ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuedAt(now - 60)
      .setExpirationTime(expired ? now - 10 : now + 3600)
      .sign(key);
  };
});

const token = (overrides: JWTPayload = {}) => ({ iss: "https://securetoken.google.com/proj-prod", aud: "proj-prod", sub: "user123", email_verified: true, ...overrides });
const verify = (t: string) => verifyIdToken(t, keys, PROJECTS);

describe("verifyIdToken", () => {
  it("accepts a token of either project and reads the caller", async () => {
    expect(await verify(await sign(token()))).toEqual({ uid: "user123", emailVerified: true });
    expect(await verify(await sign(token({ iss: "https://securetoken.google.com/proj-dev", aud: "proj-dev", email_verified: false })))).toEqual({ uid: "user123", emailVerified: false });
  });

  it("refuses tokens that aren't ours, are out of date, or aren't signed by the right key", async () => {
    expect(await verify(await sign(token({ aud: "someone-else", iss: "https://securetoken.google.com/someone-else" })))).toBeNull();
    // Issued by one of our projects for the other.
    expect(await verify(await sign(token({ aud: "proj-dev" })))).toBeNull();
    expect(await verify(await sign(token({ iss: "https://evil.example/proj-prod" })))).toBeNull();
    expect(await verify(await sign(token(), { expired: true }))).toBeNull();
    expect(await verify(await sign(token(), { key: strangerKey }))).toBeNull();
    expect(await verify(await sign(token({ sub: "" })))).toBeNull();
    expect(await verify(await sign(token({ auth_time: Math.floor(Date.now() / 1000) + 3600 })))).toBeNull();
  });

  it("refuses unsigned tokens and junk", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...token(), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    expect(await verify(unsigned)).toBeNull();
    expect(await verify("not.a.token")).toBeNull();
    expect(await verify("")).toBeNull();
  });
});

describe("bearer", () => {
  it("reads the token from the Authorization header", () => {
    expect(bearer(new Request("https://w.example/", { headers: { Authorization: "Bearer abc.def.ghi" } }))).toBe("abc.def.ghi");
    expect(bearer(new Request("https://w.example/", { headers: { Authorization: "Basic abc" } }))).toBeNull();
    expect(bearer(new Request("https://w.example/"))).toBeNull();
  });
});

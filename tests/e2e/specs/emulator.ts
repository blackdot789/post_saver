import type { APIRequestContext } from "@playwright/test";

// Helpers that talk to the Firebase emulators' REST APIs directly, standing in for the user's
// inbox and for an admin ("Bearer owner" skips the security rules).
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const PROJECT = "demo-post-saver";
const API_KEY = "demo-api-key";

export const PASSWORD = "correct horse battery";

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Creates an email/password account, optionally already verified, and returns its uid. */
export async function createUser(request: APIRequestContext, email: string, verified: boolean): Promise<string> {
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
  return localId;
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

// ---------- Firestore ----------

const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner" };

interface Value {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: Value[] };
  mapValue?: { fields?: Record<string, Value> };
}

function decode(v: Value): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(decode);
  if (v.mapValue) return decodeFields(v.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, Value>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

function encode(x: unknown): Value {
  if (x === null) return { nullValue: null };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "string") return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } };
  return { mapValue: { fields: encodeFields(x as Record<string, unknown>) } };
}

function encodeFields(data: Record<string, unknown>): Record<string, Value> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
}

/** A document as plain values (timestamps as ISO strings), or null when there's none. */
export async function readDoc(request: APIRequestContext, path: string): Promise<Record<string, unknown> | null> {
  const res = await request.get(`${DOCS}/${path}`, { headers: ADMIN });
  if (res.status() === 404) return null;
  const { fields } = (await res.json()) as { fields?: Record<string, Value> };
  return decodeFields(fields ?? {});
}

/** Writes a document as an admin would (Dates become timestamps). */
export async function writeDoc(request: APIRequestContext, path: string, data: object): Promise<void> {
  const res = await request.patch(`${DOCS}/${path}`, { headers: ADMIN, data: { fields: encodeFields(data as Record<string, unknown>) } });
  if (!res.ok()) throw new Error(`writeDoc ${path}: ${res.status()} ${await res.text()}`);
}

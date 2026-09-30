import { site } from "@postsaver/config";
import type { BatchItem, BatchResult } from "@postsaver/core";
import { getAuth } from "../auth/session.ts";

// Calls to the resolver Worker (CLAUDE.md §6.3) and to Bluesky's public API. Nothing in the app
// waits on these: a save is complete without them, and failures are simply tried again later.

/** The Worker's address: from the config, or a stand-in for the end-to-end tests. */
export const apiBase: string = import.meta.env.VITE_API_BASE_URL || site.apiBaseUrl;

const TIMEOUT_MS = 30_000;

/** The Worker couldn't be asked at all (offline, signed out, the daily limit): stop for now. */
export class ApiUnavailable extends Error {}

export async function callBatch(items: readonly BatchItem[]): Promise<BatchResult[]> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new ApiUnavailable("signed out");
  let response: Response;
  try {
    response = await fetch(`${apiBase}/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiUnavailable("no answer");
  }
  if (!response.ok) throw new ApiUnavailable(`answered ${response.status}`);
  const body = (await response.json().catch(() => null)) as { results?: unknown } | null;
  if (!Array.isArray(body?.results)) throw new ApiUnavailable("bad answer");
  return body.results as BatchResult[];
}

/**
 * A Bluesky account's permanent id (DID) for its handle, asked from Bluesky directly (handles
 * can change, so saves keep the DID). Undefined when the handle doesn't exist; throws when
 * Bluesky can't be reached.
 */
export async function resolveBskyHandle(handle: string): Promise<unknown> {
  const response = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 400 || response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Bluesky answered ${response.status}`);
  return ((await response.json()) as { did?: unknown }).did;
}

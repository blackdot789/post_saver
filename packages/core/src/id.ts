import type { ParsedLink } from "./types.ts";

// Characters that are safe in a Firestore document id and in a URL path.
const SAFE_ID = /^[A-Za-z0-9_.:~-]{1,300}$/;

/** Lowercase hex SHA-256 (Web Crypto: browsers, Workers and Node all have it). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic Firestore id for a saved link, so saving the same post twice (from any device)
 * hits the same document: `{platform}_{platformId}` when the platform id is known, otherwise
 * `url_{first 24 hex of sha256(canonicalUrl)}`.
 */
export async function saveId(link: Pick<ParsedLink, "platform" | "platformId" | "canonicalUrl">): Promise<string> {
  const { platform, platformId, canonicalUrl } = link;
  if (platform !== "web" && platformId && SAFE_ID.test(platformId)) return `${platform}_${platformId}`;
  return `url_${(await sha256Hex(canonicalUrl)).slice(0, 24)}`;
}

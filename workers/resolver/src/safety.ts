// What the Worker is willing to fetch (CLAUDE.md §6.3, §6.9). It only ever returns a final
// address or a title, never a page's content, but it still refuses anything that isn't an
// ordinary public web address.

export const MAX_URL_LENGTH = 2048;

/** Names that never belong to a public site. */
const PRIVATE_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".test", ".invalid", ".onion"];

/**
 * The URL when the Worker may fetch it: http(s) on the default port, a host name with a dot
 * (never an IP address), no sign-in details. `httpsOnly` is for the short-link hops.
 */
export function fetchable(raw: string, { httpsOnly }: { httpsOnly: boolean }): URL | null {
  if (raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) return null;
  if (url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  // The URL parser has already turned every way of writing an IPv4 address into digits and
  // dots, and IPv6 into [brackets].
  if (host.startsWith("[") || /^[0-9.]+$/.test(host)) return null;
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) return null;
  if (host === "localhost" || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return null;
  return url;
}

/** A sign-in or consent page: what platforms answer with when they don't trust the caller. */
export function isWall(url: URL): boolean {
  return /^\/(accounts\/login|login(\.php)?|checkpoint|authwall|uas\/login|i\/flow\/login|signin|signup|consent|challenge|privacy\/consent)(\/|$)/i.test(url.pathname);
}

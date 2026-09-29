const FALLBACK = "/app/";

/**
 * Where to go after sign-in. Only paths on this site are allowed, so a crafted
 * `?next=//evil.example` link can't send someone elsewhere.
 */
export function safeNext(raw: string | null | undefined, fallback = FALLBACK): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const base = "https://site.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    if (url.pathname.startsWith("/login/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** The sign-in page URL that returns to `next` afterwards. */
export function loginUrl(next: string): string {
  return `/login/?next=${encodeURIComponent(next)}`;
}

import { site, origins, hosts } from "./index.ts";

/**
 * Tokens that HTML entry files may use as %TOKEN%. Each app's Vite config replaces them,
 * so HTML never contains a hardcoded brand or domain.
 */
export function htmlTokens(): Record<string, string> {
  // Split so pages can style the last word of the brand (e.g. a gradient).
  const cut = site.brand.name.lastIndexOf(" ");
  return {
    BRAND_NAME: site.brand.name,
    BRAND_NAME_FIRST: cut > 0 ? site.brand.name.slice(0, cut) : site.brand.name,
    BRAND_NAME_LAST: cut > 0 ? site.brand.name.slice(cut + 1) : "",
    BRAND_SHORT_NAME: site.brand.shortName,
    BRAND_TAGLINE: site.brand.tagline,
    BRAND_DESCRIPTION: site.brand.description,
    THEME_COLOR: site.brand.colors.to,
    APP_ORIGIN: origins.app,
    APP_HOST: hosts.app,
    EMBED_ORIGIN: origins.embed,
    SUPPORT_EMAIL: site.contact.support,
    YEAR: String(new Date().getUTCFullYear()),
  };
}

export function applyHtmlTokens(html: string, tokens = htmlTokens()): string {
  return html.replace(/%([A-Z_]+)%/g, (match, key: string) => {
    const value = tokens[key];
    if (value === undefined) throw new Error(`Unknown HTML token ${match}`);
    return escapeHtml(value);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CspOptions {
  /** Allow the local Firebase emulators (end-to-end test builds only). */
  emulators?: boolean;
  /** Where the embed sandbox is served from, when not embed.<domain> (end-to-end test builds only). */
  embedOrigin?: string;
}

/** Content-Security-Policy for the main site, derived from config. Extended as features land. */
export function mainSiteCsp({ emulators = false, embedOrigin = origins.embed }: CspOptions = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Firebase Auth's popup/redirect sign-in loads Google's iframe helper script.
    "script-src": ["'self'", "https://apis.google.com"],
    "style-src": ["'self'"],
    // www.google.com: when the connection drops, Firestore's network layer (WebChannel) loads a
    // 1×1 image from there to tell "offline" from "server down" in its statistics.
    "img-src": ["'self'", "data:", "https://www.google.com"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      // The database (the SDK's WebChannel/long-polling connection).
      "https://firestore.googleapis.com",
      ...(emulators ? ["http://127.0.0.1:9099", "http://127.0.0.1:8080"] : []),
    ],
    // The embed sandbox, and the sign-in helper frame on auth.<domain>.
    "frame-src": [embedOrigin, origins.auth],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

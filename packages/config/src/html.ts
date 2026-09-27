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

/** Content-Security-Policy for the main site, derived from config. Extended as features land. */
export function mainSiteCsp(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": [origins.embed],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

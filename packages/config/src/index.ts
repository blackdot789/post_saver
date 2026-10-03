import { site, brands, type Brand, type FirebaseWebConfig } from "../../../site.config.ts";

export { site, brands };
export type { Brand, FirebaseWebConfig };

export type HostKey = "app" | keyof typeof site.subdomains;

/** Hostname for a given part of the product, derived from `site.domain`. */
export function host(key: HostKey): string {
  return key === "app" ? site.domain : `${site.subdomains[key]}.${site.domain}`;
}

/** `https://` origin for a given part of the product. */
export function origin(key: HostKey): string {
  return `https://${host(key)}`;
}

export const hosts = {
  app: host("app"),
  www: host("www"),
  embed: host("embed"),
  auth: host("auth"),
} as const;

export const origins = {
  app: origin("app"),
  www: origin("www"),
  embed: origin("embed"),
  auth: origin("auth"),
} as const;

export type FirebaseEnv = "dev" | "prod";

/** Firebase web config for an environment, with authDomain derived from our auth host. */
export function firebaseConfig(env: FirebaseEnv) {
  const cfg = site.firebase[env];
  if (!cfg) return null;
  return {
    ...cfg,
    // Dev runs on localhost and emulators; prod signs in through auth.<domain>.
    authDomain: env === "prod" ? hosts.auth : `${cfg.projectId}.firebaseapp.com`,
  };
}

/**
 * Literal values that must never be hardcoded outside site.config.ts (used by check-domains):
 * the domain, and the name of every brand, so that switching between them is always complete.
 */
export function forbiddenLiterals(): string[] {
  return [site.domain, ...Object.values(brands).map((brand) => brand.name)].filter((v) => v.length > 0);
}

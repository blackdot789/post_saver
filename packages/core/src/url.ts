/** Longest URL we store; the Firestore rules enforce the same cap. */
export const MAX_URL_LENGTH = 2048;

const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const WRAPPERS: ReadonlyArray<readonly [string, string]> = [
  ["<", ">"],
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
];
const HOSTNAME = /^(?:[a-z0-9_-]+\.)+[a-z0-9-]+$/;

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Turns user or app input into an http(s) URL, or null. Adds `https://` when the scheme is
 * missing, converts Android `intent://` and Bluesky `at://` links, and drops credentials.
 */
export function toUrl(input: string): URL | null {
  let s = input.replace(INVISIBLE, "").trim();
  for (const [open, close] of WRAPPERS) {
    if (s.length > 1 && s.startsWith(open) && s.endsWith(close)) s = s.slice(1, -1).trim();
  }
  if (/^https?%3a/i.test(s)) s = safeDecode(s);

  if (/^at:\/\//i.test(s)) {
    const web = atUriToUrl(s);
    if (!web) return null;
    s = web;
  } else if (/^intent:\/\//i.test(s)) {
    const scheme = /#Intent;(?:.*;)?scheme=(https?);/i.exec(s)?.[1] ?? "https";
    s = `${scheme}://${s.slice("intent://".length).replace(/#Intent;.*$/i, "")}`;
  } else if (s.startsWith("//")) {
    s = `https:${s}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    // "mailto:", "javascript:" etc. are refused, but "example.com:8080/x" is a host and port.
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^:/]+\.[^:/]+:\d/.test(s)) return null;
    s = `https://${s}`;
  }

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname.endsWith(".")) url.hostname = url.hostname.slice(0, -1);
  if (!HOSTNAME.test(url.hostname) && !url.hostname.startsWith("[")) return null;
  url.username = "";
  url.password = "";
  return url;
}

/** `at://{did or handle}/app.bsky.feed.post/{rkey}` → the bsky.app post URL. */
export function atUriToUrl(uri: string): string | null {
  const m = /^at:\/\/([^/\s?#]+)\/app\.bsky\.feed\.post\/([^/\s?#]+)\/?$/i.exec(uri.trim());
  return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : null;
}

/** Lowercase host without one leading `www.`, `m.` or `mobile.` (the URL parser lowercases). */
export function bareHost(hostname: string): string {
  return hostname.replace(/^(?:www|m|mobile)\./, "");
}

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "ttclid",
  "li_fat_id",
  "yclid",
  "igsh",
  "igshid",
  "mibextid",
  "rdt",
  "share_id",
  "xmt",
  "slof",
  "is_from_webapp",
  "sender_device",
  "rcm",
  "ref",
  "ref_src",
  "ref_url",
  "_ga",
  "_gl",
  "mkt_tok",
  "spm",
  "s_cid",
  "sr_share",
]);
const TRACKING_PREFIXES = ["utm_", "mc_", "pk_", "hsa_", "_hs", "__hs", "oly_", "vero_"];
/** Params that are tracking only on these hosts (elsewhere they may mean something). */
const HOST_TRACKING: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["open.spotify.com", new Set(["si", "context", "nd"])],
  ["youtube.com", new Set(["si", "feature", "pp"])],
  ["music.youtube.com", new Set(["si", "feature", "pp"])],
  ["youtu.be", new Set(["si", "feature"])],
  ["linkedin.com", new Set(["trk", "trackingid", "lipi", "midtoken", "midsig", "eid", "originalsubdomain"])],
  ["x.com", new Set(["s", "t"])],
  ["twitter.com", new Set(["s", "t"])],
]);

function isTracking(key: string, hostOnly: ReadonlySet<string> | undefined): boolean {
  const k = key.toLowerCase();
  return TRACKING_PARAMS.has(k) || TRACKING_PREFIXES.some((p) => k.startsWith(p)) || !!hostOnly?.has(k);
}

/**
 * Copy of `url` without tracking params and without a fragment (unless the fragment is an
 * app route like `#/…` or `#!…`). Other params keep their exact original encoding.
 */
export function cleanUrl(url: URL): URL {
  const out = new URL(url.href);
  const hostOnly = HOST_TRACKING.get(bareHost(out.hostname));
  const pairs = out.search.slice(1).split("&").filter(Boolean);
  const kept = pairs.filter((pair) => !isTracking(safeDecode(pair.split("=")[0] ?? ""), hostOnly));
  if (kept.length !== pairs.length) out.search = kept.length ? `?${kept.join("&")}` : "";
  if (!/^#[/!]/.test(out.hash)) out.hash = "";
  return out;
}

function param(url: URL, ...names: string[]): URL | null {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value) return toUrl(value);
  }
  return null;
}

/**
 * If `url` is a known redirect wrapper (Facebook/Instagram/Google outbound links, AMP, share
 * dialogs…), returns the URL it points to. Needs no network.
 */
export function unwrapRedirect(url: URL): URL | null {
  const host = url.hostname;
  const bare = bareHost(host);
  const path = url.pathname;

  if (/^(?:l|lm)\.facebook\.com$|^l\.messenger\.com$|^l\.instagram\.com$|^l\.threads\.(?:com|net)$/.test(host)) {
    return param(url, "u");
  }
  if (/^google\.[a-z.]+$/.test(bare)) {
    if (path === "/url") return param(url, "q", "url");
    const amp = /^\/amp\/(s\/)?(.+)$/.exec(path);
    if (amp?.[2]) return toUrl(`${amp[1] ? "https" : "http"}://${amp[2]}${url.search}`);
  }
  if (bare === "youtube.com") {
    if (path === "/redirect") return param(url, "q");
    if (path === "/attribution_link") {
      const u = url.searchParams.get("u");
      return u?.startsWith("/") ? toUrl(`https://www.youtube.com${u}`) : null;
    }
  }
  if (host === "out.reddit.com") return param(url, "url");
  if (bare === "linkedin.com" && (path === "/redir/redirect" || path === "/safety/go")) return param(url, "url");
  if (host === "t.umblr.com" && path === "/redirect") return param(url, "z");
  if (host === "slack-redir.net" && path === "/link") return param(url, "url");
  if (bare === "facebook.com") {
    if (/^\/plugins\/(?:post|video)\.php$/.test(path)) return param(url, "href");
    if (/^\/sharer(?:\/sharer)?\.php$/.test(path)) return param(url, "u");
  }
  return null;
}

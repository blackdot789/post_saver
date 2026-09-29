// Where the page is running, which decides how Google sign-in can work (CLAUDE.md §6.7).
// Pure functions of the user agent, so they're unit-tested without a browser.

export type Os = "android" | "ios" | "other";

/** Apps whose built-in browser is an embedded webview, where Google blocks sign-in. */
export type InAppBrowser =
  | "instagram"
  | "threads"
  | "facebook"
  | "messenger"
  | "tiktok"
  | "linkedin"
  | "snapchat"
  | "pinterest"
  | "line"
  | "wechat"
  | "webview";

export interface BrowserEnv {
  os: Os;
  inApp: InAppBrowser | null;
  /** Running as an installed app (home screen), not in a browser tab. */
  standalone: boolean;
}

// Order matters: Messenger's user agent also carries Facebook markers.
const IN_APP: ReadonlyArray<readonly [InAppBrowser, RegExp]> = [
  ["instagram", /\bInstagram\b/i],
  ["threads", /\bBarcelona\b/],
  ["messenger", /FBAN\/Messenger|FB_IAB\/MESSENGER|\bMessengerLite?\b/i],
  ["facebook", /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\[FB/],
  ["tiktok", /\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b|\btrill_/i],
  ["linkedin", /\bLinkedInApp\b/i],
  ["snapchat", /\bSnapchat\b/i],
  ["pinterest", /\bPinterest\//i],
  ["line", /\bLine\/\d/],
  ["wechat", /\bMicroMessenger\b/i],
];

export const IN_APP_NAMES: Record<InAppBrowser, string> = {
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  messenger: "Messenger",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  line: "LINE",
  wechat: "WeChat",
  webview: "this app",
};

export function detectBrowser(ua: string, standalone: boolean): BrowserEnv {
  const os: Os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "other";
  let inApp = IN_APP.find(([, re]) => re.test(ua))?.[0] ?? null;
  if (!inApp && !standalone) {
    // Unnamed embedded webviews: Android marks them "; wv)"; on iOS they lack "Safari/"
    // (so does an installed home-screen app, which is why standalone is excluded).
    if (os === "android" && /; wv\)/.test(ua)) inApp = "webview";
    if (os === "ios" && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) inApp = "webview";
  }
  return { os, inApp, standalone };
}

export type GoogleFlow = "popup" | "redirect" | "blocked";

/** Popup in browsers, a full-page redirect in the installed app, nothing inside in-app browsers. */
export function googleFlow(env: BrowserEnv): GoogleFlow {
  if (env.inApp) return "blocked";
  return env.standalone ? "redirect" : "popup";
}

/**
 * A link that leaves the in-app browser for the real one: an Android intent for Chrome (falling
 * back to the same page), or iOS 17's x-safari- scheme. Null where there's no such trick.
 */
export function openInBrowserHref(url: string, os: Os): string | null {
  const u = new URL(url);
  if (os === "android") {
    const scheme = u.protocol.slice(0, -1);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  if (os === "ios") return `x-safari-${url}`;
  return null;
}

/** The current page's environment (browser only). */
export function currentBrowser(): BrowserEnv {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectBrowser(navigator.userAgent, standalone);
}

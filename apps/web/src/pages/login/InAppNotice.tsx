import { useState } from "react";
import { IN_APP_NAMES, openInBrowserHref, type BrowserEnv } from "../../auth/environment.ts";
import { Alert } from "../../ui/Alert.tsx";

const SMALL_BUTTON =
  "inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-950 hover:bg-amber-100 " +
  "dark:border-amber-400/30 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-400/10";

/** Shown inside in-app browsers (Instagram, TikTok…), where Google refuses to sign anyone in. */
export function InAppNotice({ env }: { env: BrowserEnv }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  if (!env.inApp) return null;

  const app = IN_APP_NAMES[env.inApp];
  const browser = env.os === "ios" ? "Safari" : "Chrome";
  const href = openInBrowserHref(location.href, env.os);

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  return (
    <Alert tone="warning" title={`Google sign-in doesn't work inside ${app}`}>
      <p>Open this page in {browser} to use Google, or sign in with your email below.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {href && (
          <a href={href} className={SMALL_BUTTON}>
            Open in {browser}
          </a>
        )}
        <button type="button" onClick={copy} className={SMALL_BUTTON}>
          {copyState === "copied" ? "Link copied" : "Copy link"}
        </button>
      </div>
      {copyState === "manual" && (
        <label className="mt-3 block">
          <span className="sr-only">Page link</span>
          <input
            readOnly
            value={location.href}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-transparent dark:text-amber-100"
          />
        </label>
      )}
    </Alert>
  );
}

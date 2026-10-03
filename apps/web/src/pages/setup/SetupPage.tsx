import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { site } from "@postsaver/config";
import { currentBrowser, IN_APP_NAMES, openInBrowserHref, type BrowserEnv } from "../../auth/environment.ts";
import { loginUrl } from "../../auth/next.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { bookmarkletHref } from "../../capture/bookmarklet.ts";
import { ensureProfile } from "../../data/profile.ts";
import { install, useInstallState } from "../../lib/install.ts";
import { describeLink } from "../../lib/platforms.ts";
import { AuthLayout } from "../../ui/AuthLayout.tsx";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { cx } from "../../ui/cx.ts";
import { CheckIcon } from "../../ui/icons.tsx";
import type { LibrarySave } from "../../sync/library.ts";
import { PageSpinner, Spinner } from "../../ui/Spinner.tsx";
import { useNewSave } from "./useNewSave.ts";

// /setup/ (CLAUDE.md §6.1): gets a device ready to save posts, and ends with a live test.
// Android: install the app, so it appears in every app's Share menu. Computer: a bookmark that
// saves the page being looked at. iPhone: the share button comes in v1.2; pasting works today.

const brand = site.brand.name;
const forget = () => undefined;

type Device = "android" | "ios" | "desktop";
const DEVICES: ReadonlyArray<{ device: Device; label: string }> = [
  { device: "android", label: "Android" },
  { device: "ios", label: "iPhone" },
  { device: "desktop", label: "Computer" },
];

function deviceFromAddress(): Device | null {
  const asked = new URLSearchParams(location.search).get("device");
  return DEVICES.find((d) => d.device === asked)?.device ?? null;
}

function Step({ n, title, done = false, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3.5" data-step={n} data-done={done || undefined}>
      <span
        aria-hidden="true"
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
          done ? "bg-emerald-600 text-white" : "bg-brand-from/15 text-brand-ink dark:bg-brand-from/25 dark:text-white",
        )}
      >
        {done ? <CheckIcon className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        <div className="mt-1 space-y-3 text-sm text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </li>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-brand-ink dark:text-white">{children}</strong>;

/** Three small pictures of sharing a post to the app; each lights up in turn. */
function ShareDemo() {
  const tile = "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-xs font-medium text-brand-ink motion-safe:animate-step dark:border-white/10 dark:bg-white/5 dark:text-slate-100";
  return (
    <ol aria-label="How sharing works" className="flex gap-2">
      <li className={tile}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8" />
        </svg>
        Tap Share
      </li>
      <li className={cx(tile, "[animation-delay:2s]")}>
        <img src="/favicon.svg" alt="" width="24" height="24" className="size-6" />
        Pick {brand}
      </li>
      <li className={cx(tile, "[animation-delay:4s]")}>
        <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white">
          <CheckIcon className="size-3.5" />
        </span>
        Saved
      </li>
    </ol>
  );
}

/** The live test: waits for a post to arrive in the account, from this or any other device. */
function LiveTest({ save, how }: { save: LibrarySave | null; how: string }) {
  if (!save) {
    return (
      <>
        <p>{how}</p>
        <p role="status" className="flex items-center gap-2 font-medium text-brand-ink dark:text-white">
          <Spinner className="size-4" />
          Waiting for your post…
        </p>
      </>
    );
  }
  return (
    <div role="status" className="rounded-xl border border-emerald-600/30 bg-emerald-50 p-3.5 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50">
      <p className="font-semibold">It works!</p>
      <p className="mt-0.5">Your {describeLink(save)} is in your library.</p>
    </div>
  );
}

function AndroidSteps({ uid, env }: { uid: string; env: BrowserEnv }) {
  const state = useInstallState();
  const save = useNewSave(uid);
  const saved = save !== null;
  const installed = state === "installed";
  const outOfApp = env.inApp ? openInBrowserHref(location.href, "android") : null;
  return (
    <ol className="space-y-6">
      <Step n={1} title={`Install ${brand}`} done={installed}>
        {installed ? (
          <p>Installed. You'll find {brand} on your home screen and in the Share menu of your apps.</p>
        ) : env.inApp ? (
          <>
            <p>
              You're inside {IN_APP_NAMES[env.inApp]}'s own browser, which can't install apps. Open this page in <B>Chrome</B> first.
            </p>
            {outOfApp && (
              <ButtonLink href={outOfApp} size="sm">
                Open in Chrome
              </ButtonLink>
            )}
          </>
        ) : state === "available" ? (
          <>
            <p>Installing puts {brand} on your home screen and, more importantly, in the Share menu of every app.</p>
            <Button size="sm" onClick={() => void install().catch(forget)}>
              Install {brand}
            </Button>
          </>
        ) : (
          <p>
            In Chrome, tap the <B>⋮</B> menu at the top right, then <B>Add to Home screen</B> and <B>Install</B>. That puts {brand} in the Share menu of
            every app.
          </p>
        )}
      </Step>
      <Step n={2} title="Share a post to it" done={saved}>
        <ShareDemo />
        <p>
          In Instagram, TikTok, YouTube or any other app, tap <B>Share</B> on a post and pick <B>{brand}</B>. If it isn't in the list yet, look under{" "}
          <B>More</B>; right after installing it can take a minute to appear.
        </p>
      </Step>
      <Step n={3} title="Try it now" done={saved}>
        <LiveTest save={save} how="Share any post to the app, then come back to this page." />
      </Step>
    </ol>
  );
}

/** The "Save to …" bookmark. React refuses javascript: links, so the address is set on the element itself. */
function BookmarkButton() {
  const link = useRef<HTMLAnchorElement>(null);
  const [hint, setHint] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");
  const href = useMemo(() => bookmarkletHref(location.origin), []);
  useEffect(() => {
    link.current?.setAttribute("href", href);
  }, [href]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied("copied");
    } catch {
      setCopied("manual");
    }
  }

  return (
    <>
      <p>
        <a
          ref={link}
          data-bookmarklet=""
          draggable="true"
          // Here it would only try to save this very page; it belongs in the bookmarks bar.
          onClick={(event) => {
            event.preventDefault();
            setHint(true);
          }}
          className="inline-flex cursor-grab items-center gap-2 rounded-lg bg-linear-to-r from-brand-from to-brand-to px-3.5 py-2 font-medium text-white shadow-sm active:cursor-grabbing"
        >
          <img src="/favicon.svg" alt="" width="18" height="18" className="size-4.5 rounded-sm bg-white/90 p-0.5" />
          Save to {brand}
        </a>
      </p>
      {hint && (
        <p role="status" className="font-medium text-brand-ink dark:text-white">
          Don't click it here: drag it up to your bookmarks bar.
        </p>
      )}
      <p>
        Bookmarks bar hidden? Press <B>Ctrl + Shift + B</B> (on a Mac: <B>⌘ + Shift + B</B>).
      </p>
      <p>
        Can't drag?{" "}
        <button type="button" onClick={() => void copy()} className="text-blue-600 underline underline-offset-4 dark:text-sky-400">
          {copied === "copied" ? "Copied" : "Copy the bookmark's address"}
        </button>
        , add any page to your bookmarks, then edit that bookmark and paste this as its address.
      </p>
      {copied === "manual" && (
        <label className="block">
          <span className="sr-only">The bookmark's address</span>
          <input
            readOnly
            value={href}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-white/15 dark:bg-white/5"
          />
        </label>
      )}
    </>
  );
}

function DesktopSteps({ uid }: { uid: string }) {
  const state = useInstallState();
  const save = useNewSave(uid);
  const saved = save !== null;
  return (
    <ol className="space-y-6">
      <Step n={1} title="Add the Save button to your browser">
        <p>Drag this button to your bookmarks bar:</p>
        <BookmarkButton />
      </Step>
      <Step n={2} title="Click it on any post" done={saved}>
        <p>
          Open a post on Instagram, X, YouTube, Reddit or any other site and click <B>Save to {brand}</B> in your bookmarks bar. A small window saves the post
          and closes again.
        </p>
      </Step>
      <Step n={3} title="Try it now" done={saved}>
        <LiveTest save={save} how="Save any post with the new button (in another tab), then come back here." />
      </Step>
      {state === "available" && (
        <li className="rounded-xl border border-slate-200 p-3.5 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
          <p>
            <B>Optional:</B> install {brand} as an app on this computer, with its own window and icon.
          </p>
          <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void install().catch(forget)}>
            Install {brand}
          </Button>
        </li>
      )}
    </ol>
  );
}

function IosSteps() {
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        <B>The iPhone share button is coming soon.</B> Until then, saving from an iPhone takes two taps more:
      </p>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          In any app, tap <B>Share</B> on a post, then <B>Copy link</B>.
        </li>
        <li>
          Open your library and tap <B>Add</B>, then paste the link.
        </li>
      </ol>
      <p>
        Tip: in Safari, tap <B>Share</B> → <B>Add to Home Screen</B> to keep {brand} one tap away.
      </p>
    </div>
  );
}

export function SetupPage() {
  const auth = useAuth();
  const env = useMemo(() => currentBrowser(), []);
  const [device, setDevice] = useState<Device>(() => deviceFromAddress() ?? (env.os === "android" ? "android" : env.os === "ios" ? "ios" : "desktop"));
  const uid = auth.status === "ready" ? auth.user.uid : null;

  // The live test needs an account: send visitors to sign in and back.
  useEffect(() => {
    if (auth.status === "signed-out" || auth.status === "unverified") location.replace(loginUrl(location.pathname + location.search));
  }, [auth.status]);
  useEffect(() => {
    if (auth.status === "ready") ensureProfile(auth.user).catch(forget);
  }, [auth]);

  function choose(next: Device) {
    setDevice(next);
    history.replaceState(null, "", `${location.pathname}?device=${next}`);
  }

  if (!uid) {
    return (
      <AuthLayout>
        <PageSpinner label="Opening…" />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold tracking-tight">Set up saving</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">
        {device === "desktop" ? "Save a post from any website with one click." : "Save a post from any app in two taps."}
      </p>

      <div role="group" aria-label="Device" className="mt-5 flex overflow-hidden rounded-xl border border-slate-300 text-sm dark:border-white/15">
        {DEVICES.map((d) => (
          <button
            key={d.device}
            type="button"
            aria-pressed={device === d.device}
            onClick={() => choose(d.device)}
            className={cx("flex-1 px-3 py-2", device === d.device ? "bg-brand-from/10 font-semibold dark:bg-brand-from/25" : "hover:bg-slate-100 dark:hover:bg-white/10")}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {device === "android" ? <AndroidSteps uid={uid} env={env} /> : device === "desktop" ? <DesktopSteps uid={uid} /> : <IosSteps />}
      </div>

      <ButtonLink href="/app/" variant="secondary" className="mt-8">
        Open library
      </ButtonLink>
    </AuthLayout>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { parse, type ParsedLink, type SaveSource } from "@postsaver/core";
import { loginUrl } from "../../auth/next.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { readCapture } from "../../capture/input.ts";
import { addPending, listPending, removePending, type PendingSave } from "../../capture/pending.ts";
import { ensureProfile } from "../../data/profile.ts";
import { AuthLayout } from "../../ui/AuthLayout.tsx";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";
import { LinkPreview } from "./LinkPreview.tsx";
import { PasteForm } from "./PasteForm.tsx";
import { SaveResult, SaveRow, finish } from "./SaveResult.tsx";

// /save/ and /share/ (the Android share target): one page, CLAUDE.md §6.1.
// - A link in ?url=, ?text= or ?title= is saved at once.
// - Signed out or unverified: the link waits on this device and is saved after sign-in, which
//   returns here (NEXT) and finds it in the waiting list.
// - Nothing passed in: links waiting from before sign-in, or else a box to paste one.

const NEXT = "/save/";
const forget = () => undefined;

interface Target {
  link: ParsedLink;
  source: SaveSource;
}

/** Drops the shared link from the address bar, so a reload doesn't save it again. */
function clearInput() {
  history.replaceState(null, "", location.pathname);
}

function KeepForLater({ target, unverified }: { target: Target; unverified: boolean }) {
  const [kept, setKept] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    addPending({ url: target.link.originalUrl, source: target.source, at: Date.now() }).then(
      () => {
        if (!live) return;
        clearInput();
        setKept(true);
      },
      () => live && setKept(false),
    );
    return () => {
      live = false;
    };
  }, [target]);

  if (kept === null) return <PageSpinner label="Opening…" />;
  // If this browser can't keep the link, carry it through sign-in in the address instead.
  const next = kept ? NEXT : location.pathname + location.search;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{unverified ? "Verify your email to save this" : "Sign in to save this"}</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">
        {unverified
          ? "Your library saves posts once your email address is verified. We'll save this link as soon as it is."
          : "We'll keep this link and save it to your library as soon as you're signed in."}
      </p>
      <LinkPreview link={target.link} className="mt-5" />
      <div className="mt-6 space-y-3">
        {unverified ? (
          <ButtonLink href={loginUrl(next)}>Verify my email</ButtonLink>
        ) : (
          <>
            <ButtonLink href={loginUrl(next)}>Sign in</ButtonLink>
            <ButtonLink href={`/login/?mode=signup&next=${encodeURIComponent(next)}`} variant="secondary">
              Create an account
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}

function NoLink({ text, onLink }: { text: string; onLink: (link: ParsedLink) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">No link found</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">There's no link to a post in what was shared:</p>
      <blockquote className="mt-3 line-clamp-6 rounded-xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-sm break-words whitespace-pre-wrap text-slate-700 dark:border-white/20 dark:bg-white/5 dark:text-slate-300">
        {text}
      </blockquote>
      <p className="mt-4 mb-4 text-slate-600 dark:text-slate-300">
        In the app, try <strong className="font-semibold">Share → Copy link</strong>, then paste it here.
      </p>
      <PasteForm onLink={onLink} />
    </div>
  );
}

/** Links shared before sign-in. One gets the full view (with tags and a note), several a list. */
function Waiting({ uid, items }: { uid: string; items: PendingSave[] }) {
  const parsed = useMemo(() => items.map((item) => ({ item, link: parse(item.url) })), [items]);
  const entries = parsed.flatMap(({ item, link }) => (link ? [{ item, link }] : []));
  const done = (url: string) => () => void removePending(url).catch(forget);

  // Nothing can be done with a link that no longer parses; drop it from the waiting list.
  useEffect(() => {
    for (const { item, link } of parsed) if (!link) removePending(item.url).catch(forget);
  }, [parsed]);

  const only = entries.length === 1 ? entries[0] : undefined;
  if (only) return <SaveResult uid={uid} link={only.link} source={only.item.source} onStored={done(only.item.url)} />;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Saving what you shared</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">You shared these before signing in.</p>
      <ul className="mt-4 divide-y divide-slate-200 dark:divide-white/10">
        {entries.map(({ item, link }) => (
          <SaveRow key={item.url} uid={uid} link={link} source={item.source} onStored={done(item.url)} />
        ))}
      </ul>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <ButtonLink href="/app/" variant="secondary">
          Open library
        </ButtonLink>
        <Button onClick={finish}>Done</Button>
      </div>
    </div>
  );
}

function Start({ uid, onLink }: { uid: string; onLink: (link: ParsedLink) => void }) {
  const [waiting, setWaiting] = useState<PendingSave[] | null>(null);
  useEffect(() => {
    listPending().then(setWaiting, () => setWaiting([]));
  }, []);

  if (waiting === null) return <PageSpinner label="Opening…" />;
  if (waiting.length > 0) return <Waiting uid={uid} items={waiting} />;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Save a post</h1>
      <p className="mt-1.5 mb-5 text-slate-600 dark:text-slate-300">Paste a link from any app or website.</p>
      <PasteForm onLink={onLink} autoFocus />
      <p className="mt-5 text-center text-sm">
        <a href="/app/" className="text-blue-600 underline-offset-4 hover:underline dark:text-sky-400">
          Open your library
        </a>
      </p>
    </div>
  );
}

export function SavePage({ source }: { source: SaveSource }) {
  const request = useMemo(() => readCapture(location.search, source), [source]);
  const shared = useMemo<Target | null>(() => (request.link ? { link: request.link, source: request.source } : null), [request]);
  const [pasted, setPasted] = useState<Target | null>(null);
  const popup = useMemo(() => window.opener != null, []);
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const target = pasted ?? shared;

  // With nothing to save, the page needs an account: send visitors to sign in and back.
  useEffect(() => {
    if (!request.hasInput && (auth.status === "signed-out" || auth.status === "unverified")) {
      location.replace(loginUrl(NEXT));
    }
  }, [auth.status, request.hasInput]);

  useEffect(() => {
    if (auth.status === "ready") ensureProfile(auth.user).catch(forget);
  }, [auth]);

  useEffect(() => {
    if (uid && shared) clearInput();
  }, [uid, shared]);

  const onLink = (link: ParsedLink) => setPasted({ link, source: "paste" });

  let body: ReactNode;
  if (auth.status === "loading") body = <PageSpinner label="Opening…" />;
  else if (target && uid) {
    body = (
      <SaveResult key={target.link.canonicalUrl} uid={uid} link={target.link} source={target.source} autoClose={popup && !pasted} />
    );
  } else if (target) body = <KeepForLater target={target} unverified={auth.status === "unverified"} />;
  else if (request.hasInput) body = <NoLink text={request.sharedText} onLink={onLink} />;
  else if (uid) body = <Start uid={uid} onLink={onLink} />;
  else body = <PageSpinner label="Opening sign-in…" />;

  return <AuthLayout>{body}</AuthLayout>;
}

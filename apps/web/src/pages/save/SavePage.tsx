import { useEffect, useMemo, useState, type ReactNode } from "react";
import { textId, type SaveSource } from "@postsaver/core";
import { loginUrl } from "../../auth/next.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { readCapture } from "../../capture/input.ts";
import { itemKey, type Item } from "../../capture/item.ts";
import { addPending, listPending, removePending, type PendingSave } from "../../capture/pending.ts";
import { pendingItem } from "../../capture/saveLink.ts";
import { ensureProfile } from "../../data/profile.ts";
import { AuthLayout } from "../../ui/AuthLayout.tsx";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";
import { LinkPreview } from "./LinkPreview.tsx";
import { PasteForm } from "./PasteForm.tsx";
import { SaveResult, SaveRow, finish } from "./SaveResult.tsx";
import { TextPreview } from "./TextPreview.tsx";

// /save/ and /share/ (the Android share target): one page, CLAUDE.md §6.1.
// - A link in ?url=, ?text= or ?title= is saved at once; words shared without a link are saved
//   as a text.
// - Signed out or unverified: it waits on this device and is saved after sign-in, which returns
//   here (NEXT) and finds it in the waiting list.
// - Nothing passed in: what waits from before sign-in, or else a box to paste a link or a text.

const NEXT = "/save/";
const forget = () => undefined;

interface Target {
  item: Item;
  source: SaveSource;
}

/** The waiting-list entry for a shared link or text. */
async function toPending({ item, source }: Target): Promise<PendingSave> {
  const at = Date.now();
  return item.link ? { url: item.link.originalUrl, source, at } : { url: `text:${await textId(item.text)}`, text: item.text, source, at };
}

/** Drops the shared link from the address bar, so a reload doesn't save it again. */
function clearInput() {
  history.replaceState(null, "", location.pathname);
}

function KeepForLater({ target, unverified }: { target: Target; unverified: boolean }) {
  const [kept, setKept] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    toPending(target)
      .then(addPending)
      .then(
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
  // If this browser can't keep it, carry it through sign-in in the address instead.
  const next = kept ? NEXT : location.pathname + location.search;
  const what = target.item.link ? "link" : "text";
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{unverified ? "Verify your email to save this" : "Sign in to save this"}</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">
        {unverified
          ? `Your library saves posts once your email address is verified. We'll save this ${what} as soon as it is.`
          : `We'll keep this ${what} and save it to your library as soon as you're signed in.`}
      </p>
      {target.item.link ? <LinkPreview link={target.item.link} className="mt-5" /> : <TextPreview text={target.item.text} className="mt-5" />}
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

function NoLink({ text, onItem }: { text: string; onItem: (item: Item) => void }) {
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
      <PasteForm onItem={onItem} />
    </div>
  );
}

/** Links and texts shared before sign-in. One gets the full view (with tags and a note), several a list. */
function Waiting({ uid, items }: { uid: string; items: PendingSave[] }) {
  const parsed = useMemo(() => items.map((entry) => ({ entry, item: pendingItem(entry) })), [items]);
  const entries = parsed.flatMap(({ entry, item }) => (item ? [{ entry, item }] : []));
  const done = (url: string) => () => void removePending(url).catch(forget);

  // Nothing can be done with a link that no longer parses; drop it from the waiting list.
  useEffect(() => {
    for (const { entry, item } of parsed) if (!item) removePending(entry.url).catch(forget);
  }, [parsed]);

  const only = entries.length === 1 ? entries[0] : undefined;
  if (only) return <SaveResult uid={uid} item={only.item} source={only.entry.source} onStored={done(only.entry.url)} />;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Saving what you shared</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">You shared these before signing in.</p>
      <ul className="mt-4 divide-y divide-slate-200 dark:divide-white/10">
        {entries.map(({ entry, item }) => (
          <SaveRow key={entry.url} uid={uid} item={item} source={entry.source} onStored={done(entry.url)} />
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

function Start({ uid, onItem }: { uid: string; onItem: (item: Item) => void }) {
  const [waiting, setWaiting] = useState<PendingSave[] | null>(null);
  useEffect(() => {
    listPending().then(setWaiting, () => setWaiting([]));
  }, []);

  if (waiting === null) return <PageSpinner label="Opening…" />;
  if (waiting.length > 0) return <Waiting uid={uid} items={waiting} />;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Save a post</h1>
      <p className="mt-1.5 mb-5 text-slate-600 dark:text-slate-300">Paste a link from any app or website, or a text you want on your other devices.</p>
      <PasteForm onItem={onItem} autoFocus />
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
  const shared = useMemo<Target | null>(() => {
    const item: Item | null = request.link ? { link: request.link } : request.text ? { text: request.text } : null;
    return item ? { item, source: request.source } : null;
  }, [request]);
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

  const onItem = (item: Item) => setPasted({ item, source: "paste" });

  let body: ReactNode;
  if (auth.status === "loading") body = <PageSpinner label="Opening…" />;
  else if (target && uid) {
    body = (
      <SaveResult key={itemKey(target.item)} uid={uid} item={target.item} source={target.source} autoClose={popup && !pasted} />
    );
  } else if (target) body = <KeepForLater target={target} unverified={auth.status === "unverified"} />;
  else if (request.hasInput) body = <NoLink text={request.sharedText} onItem={onItem} />;
  else if (uid) body = <Start uid={uid} onItem={onItem} />;
  else body = <PageSpinner label="Opening sign-in…" />;

  return <AuthLayout>{body}</AuthLayout>;
}

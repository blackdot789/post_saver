import { useEffect, useState } from "react";
import type { ParsedLink, SaveSource } from "@postsaver/core";
import { moveSaveToTop } from "../../data/edits.ts";
import { enrichSaved } from "../../enrich/run.ts";
import { useSave, type SaveState } from "../../capture/useSave.ts";
import { describeLink, formatDay } from "../../lib/platforms.ts";
import { useOnline } from "../../lib/useOnline.ts";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { cx } from "../../ui/cx.ts";
import { AlertIcon, CheckIcon } from "../../ui/icons.tsx";
import { Spinner } from "../../ui/Spinner.tsx";
import { LinkPreview } from "./LinkPreview.tsx";
import { errorMessage } from "./messages.ts";
import { QuickActions } from "./QuickActions.tsx";

const CLOSE_AFTER_MS = 1500;

/** Closes a popup or share window; anywhere else, goes to the library. */
export function finish() {
  window.close();
  setTimeout(() => location.assign("/app/"), 200);
}

function title(state: SaveState): string {
  if (state.sync === "failed") return "Couldn't save this post";
  if (state.sync === "saving") return "Saving…";
  if (state.outcome === "exists") return "Already saved";
  return state.outcome === "restored" ? "Restored from Trash" : "Saved";
}

function detail(state: SaveState, online: boolean, moved: boolean): string {
  if (state.sync === "failed") return errorMessage(state.error);
  if (state.sync === "saving") return "";
  if (state.outcome === "exists") {
    if (moved) return "Moved to the top of your library.";
    return state.savedAt ? `You saved this on ${formatDay(state.savedAt)}.` : "It's in your library already.";
  }
  if (state.sync === "synced") return "Synced to your library.";
  return online ? "Syncing…" : "Saved on this device. It syncs when you're back online.";
}

function StatusIcon({ state }: { state: SaveState }) {
  const failed = state.sync === "failed";
  return (
    <div
      className={cx(
        "grid size-11 shrink-0 place-items-center rounded-2xl text-white",
        failed ? "bg-red-600" : "bg-linear-to-br from-brand-from to-brand-to",
      )}
    >
      {state.sync === "saving" ? <Spinner className="size-5" /> : failed ? <AlertIcon className="size-6" /> : <CheckIcon className="size-6" />}
    </div>
  );
}

interface SaveResultProps {
  uid: string;
  link: ParsedLink;
  source: SaveSource;
  onStored?: () => void;
  /** Close the window once saved (the page was opened as a popup, e.g. by the bookmarklet). */
  autoClose?: boolean;
  /** Inside the library's Add dialog: no "Open library" / "Done" buttons. */
  compact?: boolean;
}

/** Saves one link and shows how it went, with quick actions (the main /save/ and /share/ view). */
export function SaveResult({ uid, link, source, onStored, autoClose = false, compact = false }: SaveResultProps) {
  const [state, retry] = useSave(uid, link, source, onStored);
  const online = useOnline();
  const [moved, setMoved] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const settled = state.sync === "synced" || (state.sync === "pending" && (!online || state.outcome === "exists"));
  const closing = autoClose && settled && !touched;

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => window.close(), CLOSE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  // Once the server has the save, look up its title (and open a short link) without holding anything up.
  const saved = state.sync === "synced" ? state.id : undefined;
  useEffect(() => {
    if (saved) void enrichSaved(uid, saved);
  }, [uid, saved]);

  function moveToTop() {
    if (!state.id) return;
    setMoved(true);
    setMoveError(null);
    moveSaveToTop(uid, state.id).catch((error: unknown) => {
      setMoved(false);
      setMoveError(errorMessage(error));
    });
  }

  const text = detail(state, online, moved);
  return (
    <div onPointerDown={() => setTouched(true)} onKeyDown={() => setTouched(true)}>
      <div className="flex items-start gap-3.5">
        <StatusIcon state={state} />
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{title(state)}</h1>
          <p role="status" className="mt-0.5 min-h-5 text-sm text-slate-600 dark:text-slate-300">
            {text}
            {closing && " This window closes in a moment."}
          </p>
        </div>
      </div>

      <LinkPreview link={link} className="mt-5" />

      {state.sync === "failed" && (
        <Button className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
      {state.outcome === "exists" && state.sync !== "failed" && !moved && (
        <Button variant="secondary" className="mt-4" onClick={moveToTop}>
          Move to top
        </Button>
      )}
      {moveError && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {moveError}
        </p>
      )}

      {state.id && state.sync !== "failed" && <QuickActions uid={uid} id={state.id} />}

      {!compact && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <ButtonLink href="/app/" variant="secondary">
            Open library
          </ButtonLink>
          <Button onClick={finish}>Done</Button>
        </div>
      )}
    </div>
  );
}

const ROW_STATUS: Record<string, string> = {
  created: "Saved",
  restored: "Restored",
  exists: "Already saved",
};

/** One line per link, for the links that waited on this device until sign-in. */
export function SaveRow({ uid, link, source, onStored }: Omit<SaveResultProps, "autoClose">) {
  const [state] = useSave(uid, link, source, onStored);
  const status =
    state.sync === "saving" ? "Saving…" : state.sync === "failed" ? errorMessage(state.error) : ROW_STATUS[state.outcome ?? ""];
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{describeLink(link)}</p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{link.canonicalUrl}</p>
      </div>
      <span
        className={cx(
          "shrink-0 text-sm font-medium",
          state.sync === "failed" ? "max-w-[50%] text-right text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300",
        )}
      >
        {status}
      </span>
    </li>
  );
}

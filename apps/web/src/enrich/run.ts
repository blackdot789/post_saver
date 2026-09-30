import { useEffect, useRef } from "react";
import { getDocFromCache } from "firebase/firestore";
import type { BatchItem } from "@postsaver/core";
import { saveRef } from "../data/firestore.ts";
import { readLocal, writeLocal } from "../lib/storage.ts";
import { toLibrarySave, type LibrarySave } from "../sync/library.ts";
import type { Library } from "../sync/useLibrary.ts";
import { callBatch, resolveBskyHandle } from "./api.ts";
import { applyMeta, applyResolved } from "./apply.ts";
import { afterFailure, BATCH_SIZE, bskyParts, bskyPostUrl, GIVEN_UP, pickWork, pruneAttempts, type Attempts, type Work } from "./queue.ts";

// The enrichment queue (CLAUDE.md §6.3): saves that still wait for their short link to be
// opened, or for a title, are worked through a batch at a time while the library is open.
// Nothing waits on it, and every failure is tried again later, up to five times per device.

const ATTEMPTS_KEY = "ps:enrich:";
/** The pause between two batches. */
const PAUSE_MS = 1500;

function load(uid: string): Attempts {
  try {
    const parsed: unknown = JSON.parse(readLocal(ATTEMPTS_KEY + uid) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Attempts) : {};
  } catch {
    return {};
  }
}

const store = (uid: string, attempts: Attempts) => writeLocal(ATTEMPTS_KEY + uid, JSON.stringify(attempts));

/** Records a failed try that was only reported later (the server refused a write). */
function failLater(uid: string, id: string): void {
  const attempts = load(uid);
  attempts[id] = afterFailure(attempts[id], Date.now());
  store(uid, attempts);
}

async function runBatch(uid: string, saves: readonly LibrarySave[]): Promise<boolean> {
  const attempts = pruneAttempts(load(uid), saves);
  const work = pickWork(saves, attempts, Date.now());
  if (work.length === 0) {
    store(uid, attempts);
    return false;
  }
  const fail = (w: Work) => {
    attempts[w.save.id] = afterFailure(attempts[w.save.id], Date.now());
  };
  const giveUp = (w: Work) => {
    attempts[w.save.id] = GIVEN_UP;
  };
  const resolved = async (w: Work, finalUrl: string) => {
    try {
      const written = await applyResolved(uid, w.save, finalUrl);
      if (written) written.done.catch(() => failLater(uid, w.save.id));
      else fail(w);
    } catch {
      fail(w);
    }
  };

  // What this browser can settle by itself.
  for (const w of work) {
    if (w.do === "reparse") await resolved(w, w.save.url);
    if (w.do !== "bsky") continue;
    const parts = bskyParts(w.save.url);
    if (!parts) {
      giveUp(w);
      continue;
    }
    try {
      const url = bskyPostUrl(await resolveBskyHandle(parts.handle), parts.rkey);
      if (url) await resolved(w, url);
      else giveUp(w);
    } catch {
      fail(w);
    }
  }

  // What the Worker looks up.
  const remote = work.filter((w) => w.do === "resolve" || w.do === "meta");
  if (remote.length > 0) {
    let results;
    try {
      results = await callBatch(remote.map((w): BatchItem => ({ url: w.save.url, do: w.do === "meta" ? "meta" : "resolve" })));
    } catch {
      // The Worker couldn't be asked: that says nothing about these saves.
      store(uid, attempts);
      return false;
    }
    for (const [i, w] of remote.entries()) {
      const r = results[i];
      if (!r || r.url !== w.save.url) fail(w);
      else if (r.ok && r.do === "meta") applyMeta(uid, w.save, r.meta).catch(() => failLater(uid, w.save.id));
      else if (r.ok && r.do === "resolve") await resolved(w, r.finalUrl);
      else if (!r.ok && r.retry) fail(w);
      // Nothing to find, now or later. For metadata that's recorded on the save, so no device asks again.
      else if (w.do === "meta") applyMeta(uid, w.save, {}).catch(() => undefined);
      else giveUp(w);
    }
  }
  store(uid, attempts);
  return work.length === BATCH_SIZE;
}

let running = false;

/**
 * Works through one batch of the saves that wait for something. Resolves with whether it's
 * worth calling again soon (a full batch was done, or another call was still at work). Only
 * one runs at a time, in this tab and (where the browser can say) in others.
 */
export async function enrich(uid: string, saves: readonly LibrarySave[]): Promise<boolean> {
  if (!navigator.onLine) return false;
  if (running) return true;
  running = true;
  try {
    if (!navigator.locks) return await runBatch(uid, saves);
    return await navigator.locks.request(`ps-enrich-${uid}`, { ifAvailable: true }, (lock) => (lock ? runBatch(uid, saves) : false));
  } catch {
    return false;
  } finally {
    running = false;
  }
}

/** Looks up what one save waits for, right after it was saved (the /save/ page). */
export async function enrichSaved(uid: string, id: string): Promise<void> {
  try {
    const snap = await getDocFromCache(saveRef(uid, id));
    const data = snap.data();
    if (data && data.deleted !== true) await enrich(uid, [toLibrarySave(snap.id, data, snap.metadata.hasPendingWrites)]);
  } catch {
    // Not in the cache: the library will pick it up.
  }
}

/** Keeps the queue going while the library is open and in sync. */
export function useEnrichment(uid: string, library: Library): void {
  const saves = useRef(library.saves);
  useEffect(() => {
    saves.current = library.saves;
  });
  const ready = library.loaded && library.status === "synced";

  useEffect(() => {
    if (!ready) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pump = () => {
      void enrich(uid, saves.current).then((more) => {
        if (live && more) timer = setTimeout(pump, PAUSE_MS);
      });
    };
    pump();
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Runs again when the library changes: a new save may be waiting.
  }, [uid, ready, library.saves]);
}

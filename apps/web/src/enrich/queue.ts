import { LIMITS, META_PLATFORMS, TEXT_PLATFORM, parse, type LinkMeta } from "@postsaver/core";
import type { LibrarySave } from "../sync/library.ts";

// The decisions of the enrichment queue (CLAUDE.md §6.3), kept pure so they can be tested: which
// saves still wait for something, when to try again, and what a finished lookup changes.

/** A save is tried this many times on a device, then left as it is. */
export const MAX_TRIES = 5;
/** The wait after each failed try: 1 min, 10 min, 1 h, 6 h, 1 day. */
const BACKOFF_MS = [60_000, 600_000, 3_600_000, 21_600_000, 86_400_000];
/** Saves handled per call to the Worker. */
export const BATCH_SIZE = 20;

export interface Attempt {
  tries: number;
  /** Not before this time (ms). */
  nextAt: number;
}

/** save id → how trying has gone so far, on this device. */
export type Attempts = Record<string, Attempt>;

export interface Work {
  save: LibrarySave;
  /**
   * resolve: the Worker follows a short link · bsky: this browser looks up a Bluesky handle ·
   * reparse: the link needs no lookup any more (a newer app understands it) · meta: title and author
   */
  do: "resolve" | "bsky" | "reparse" | "meta";
}

function workFor(save: LibrarySave): Work["do"] | null {
  // A saved text has no link: there's nothing to open or look up.
  if (save.platform === TEXT_PLATFORM) return null;
  if (save.needsResolve) {
    const via = parse(save.url)?.resolveVia;
    return via === "redirect" ? "resolve" : via === "bsky-handle" ? "bsky" : "reparse";
  }
  return save.needsMeta && META_PLATFORMS.has(save.platform) ? "meta" : null;
}

/** The saves to work on now, newest first: waiting for something, not given up on, not backing off. */
export function pickWork(saves: readonly LibrarySave[], attempts: Attempts, now: number, limit = BATCH_SIZE): Work[] {
  const work: Work[] = [];
  for (const save of saves) {
    if (work.length >= limit) break;
    // A save still on its way to the server is left alone: its first write goes first.
    if (save.status !== "active" || save.pending) continue;
    const todo = workFor(save);
    if (!todo) continue;
    const attempt = attempts[save.id];
    if (attempt && (attempt.tries >= MAX_TRIES || now < attempt.nextAt)) continue;
    work.push({ save, do: todo });
  }
  return work;
}

/** The record after a failed try. */
export function afterFailure(attempt: Attempt | undefined, now: number): Attempt {
  const tries = (attempt?.tries ?? 0) + 1;
  return { tries, nextAt: now + (BACKOFF_MS[Math.min(tries, BACKOFF_MS.length) - 1] ?? 0) };
}

/** The record for a save that trying again won't help. */
export const GIVEN_UP: Attempt = { tries: MAX_TRIES, nextAt: 0 };

/** Forgets saves that are gone or need nothing any more. */
export function pruneAttempts(attempts: Attempts, saves: readonly LibrarySave[]): Attempts {
  const waiting = new Set(saves.filter((s) => workFor(s)).map((s) => s.id));
  return Object.fromEntries(Object.entries(attempts).filter(([id]) => waiting.has(id)));
}

/** What a metadata answer changes on a save. The author from the link itself (a handle) wins. */
export function metaChanges(save: Pick<LibrarySave, "author" | "title">, meta: LinkMeta): { title?: string; author?: string; thumb?: string } {
  const title = meta.title?.slice(0, LIMITS.title);
  const author = meta.author?.slice(0, LIMITS.author);
  return {
    ...(title && !save.title ? { title } : {}),
    ...(author && !save.author ? { author } : {}),
    ...(meta.thumb ? { thumb: meta.thumb } : {}),
  };
}

/** The user's own additions to a save. */
export interface Extras {
  tags: string[];
  collectionIds: string[];
  favorite: boolean;
  note?: string;
}

/**
 * What the save of a post gains when a short link to the same post is folded into it
 * (CLAUDE.md §6.2): the short link's tags, collections, favorite and note. Null when nothing.
 */
export function mergeExtras(into: Extras, from: Extras): Partial<Extras> | null {
  const tags = [...new Set([...into.tags, ...from.tags])].slice(0, LIMITS.tags);
  const collectionIds = [...new Set([...into.collectionIds, ...from.collectionIds])].slice(0, LIMITS.collectionIds);
  const changes: Partial<Extras> = {
    ...(tags.length > into.tags.length ? { tags } : {}),
    ...(collectionIds.length > into.collectionIds.length ? { collectionIds } : {}),
    ...(from.favorite && !into.favorite ? { favorite: true } : {}),
    ...(from.note && !into.note ? { note: from.note } : {}),
  };
  return Object.keys(changes).length > 0 ? changes : null;
}

const DID = /^did:[a-z]+:[A-Za-z0-9._:%-]{1,200}$/;

/** The Bluesky handle and post key in a saved link like bsky.app/profile/{handle}/post/{rkey}. */
export function bskyParts(url: string): { handle: string; rkey: string } | null {
  try {
    const [profile, handle, post, rkey] = new URL(url).pathname.split("/").filter(Boolean);
    return profile === "profile" && post === "post" && handle && rkey ? { handle: decodeURIComponent(handle), rkey } : null;
  } catch {
    return null;
  }
}

/** The post's address with the account's permanent id instead of its handle. */
export function bskyPostUrl(did: unknown, rkey: string): string | null {
  return typeof did === "string" && DID.test(did) ? `https://bsky.app/profile/${did}/post/${rkey}` : null;
}

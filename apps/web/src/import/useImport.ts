import { arrayUnion, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { newSave, parse, type SaveSource } from "@postsaver/core";
import type { RemoteConfig } from "../data/appConfig.ts";
import { createCollection, newCollectionId, type Collection } from "../data/collections.ts";
import { trashSave } from "../data/edits.ts";
import { getDb, saveRef } from "../data/firestore.ts";
import { readLocal, writeLocal } from "../lib/storage.ts";
import type { Library } from "../sync/useLibrary.ts";
import { jobTotal, loadJob, removeJob, storeJob, type ImportJob } from "./jobs.ts";
import { countWrites, DEFAULT_DAILY_CAP, leftToday, type DayCount, type ImportPlan } from "./plan.ts";
import type { ImportType } from "./types.ts";

// Runs an import (CLAUDE.md §6.1, §6.11): a few saves at a time, never more per day than the
// limit, picking up where it left off whenever the library is open on this device.

/** Entries dealt with per step, and the pause between steps. */
const CHUNK = 20;
const STEP_MS = 400;
/** The account's imports/{id} document is updated this often (in entries), and at every stop. */
const REPORT_EVERY = 200;
const DAY_KEY = "ps:import-day:";

/**
 * running · paused (by the person) · waiting (today's limit is used up; continues tomorrow) ·
 * held (imports are switched off for everyone at the moment)
 */
export type ImportStatus = "running" | "paused" | "waiting" | "held";

export interface ImportView {
  type: ImportType;
  total: number;
  cursor: number;
  status: ImportStatus;
  /** Posts an account may import per day. */
  cap: number;
}

export interface ImportSummary {
  type: ImportType;
  /** Posts added, and saves that gained tags or collections or went to the Trash. */
  added: number;
  changed: number;
}

export interface ImportControls {
  view: ImportView | null;
  /** Posts an account may import per day. */
  cap: number;
  /** The last import's result, until dismissed. */
  finished: ImportSummary | null;
  start: (plan: ImportPlan, options: { trashMissing: boolean }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  dismiss: () => void;
}

function readDay(uid: string): DayCount | null {
  try {
    const parsed = JSON.parse(readLocal(DAY_KEY + uid) ?? "null") as DayCount | null;
    return parsed && typeof parsed.day === "string" && typeof parsed.count === "number" ? parsed : null;
  } catch {
    return null;
  }
}

const importRef = (uid: string, id: string) => doc(getDb(), "users", uid, "imports", id);
const forget = () => undefined;

function report(job: ImportJob, status: "running" | "paused" | "done" | "cancelled"): void {
  updateDoc(importRef(job.uid, job.id), { done: job.cursor, cursor: job.cursor, status, updatedAt: serverTimestamp() }).catch(forget);
}

/**
 * `config` is `config/app` once it has been read, null before: nothing is imported until the
 * day's limit and the remote pause are known.
 */
export function useImport(uid: string, library: Library, collections: readonly Collection[], config: RemoteConfig | null): ImportControls {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [finished, setFinished] = useState<ImportSummary | null>(null);
  // Bumped after every step, to run the next one.
  const [tick, setTick] = useState(0);
  const busy = useRef(false);
  const latest = useRef({ library, collections });
  // The job as the person last left it, for a step that's still running when they pause or cancel.
  const current = useRef<ImportJob | null>(null);
  useEffect(() => {
    latest.current = { library, collections };
    current.current = job;
  });

  useEffect(() => {
    let live = true;
    loadJob(uid).then((stored) => live && setJob(stored), forget);
    return () => {
      live = false;
    };
  }, [uid]);

  const cap = Math.max(0, Math.floor(config?.importDailyCap ?? DEFAULT_DAILY_CAP));
  const left = leftToday(readDay(uid), cap, Date.now());
  const status: ImportStatus | null = !job ? null : job.paused ? "paused" : config?.importPaused ? "held" : left <= 0 ? "waiting" : "running";
  const ready = library.loaded && config !== null;

  useEffect(() => {
    if (!job || status !== "running" || !ready || busy.current) return;
    busy.current = true;
    let started = false;
    const timer = setTimeout(() => {
      started = true;
      void step(job, left)
        .then(({ next, complete }) => {
          if (complete) setFinished({ type: next.type, added: next.added, changed: next.changed });
          // Paused or cancelled while the step ran: that still holds.
          setJob((now) => (now?.id !== next.id ? now : complete ? null : { ...next, paused: now.paused }));
        }, forget)
        .finally(() => {
          busy.current = false;
          setTick((n) => n + 1);
        });
    }, STEP_MS);
    return () => {
      // A step that has started always runs to its end; only a step still waiting is called off.
      if (!started) {
        clearTimeout(timer);
        busy.current = false;
      }
    };
    // `tick` restarts the effect after a step, also when the step changed nothing.
  }, [job, status, ready, tick]);

  /** Deals with the next few entries. Resolves with the job as it is afterwards, and whether that was the last of it. */
  async function step(from: ImportJob, allowed: number): Promise<{ next: ImportJob; complete: boolean }> {
    const next: ImportJob = { ...from, collectionIds: { ...from.collectionIds } };
    const total = jobTotal(next);
    const have = new Map(latest.current.library.saves.map((s) => [s.id, s]));
    const source = `import-${next.type}` as SaveSource;
    let writes = 0;

    // Collections are found by name, or created, the first time an entry needs them.
    const collectionId = (name: string): string => {
      const key = name.toLowerCase();
      let id = next.collectionIds[key] ?? latest.current.collections.find((c) => c.name.toLowerCase() === key)?.id;
      if (!id) {
        const created = createCollection(next.uid, name, latest.current.collections.length + Object.keys(next.collectionIds).length);
        created.done.catch(forget);
        id = created.id;
        writes++;
      }
      next.collectionIds[key] = id;
      return id;
    };

    const end = Math.min(total, next.cursor + CHUNK);
    while (next.cursor < end && writes < allowed) {
      const at = next.cursor++;
      const now = serverTimestamp();
      if (at < next.add.length) {
        const entry = next.add[at]!;
        const link = parse(entry.url);
        // Saved some other way since the import was planned: nothing to do.
        if (!link || have.has(entry.id)) continue;
        setDoc(saveRef(next.uid, entry.id), {
          ...newSave(link, { source, now, savedAt: entry.savedAt ? Timestamp.fromMillis(entry.savedAt) : now, tags: entry.tags, note: entry.note }),
          collectionIds: entry.collections.map(collectionId),
          ...(entry.favorite ? { favorite: true } : {}),
          // A title from the file is enough for an ordinary page: no lookup needed.
          ...(entry.title ? { title: entry.title, needsMeta: false } : {}),
        }).catch(forget);
        writes++;
        next.added++;
      } else if (at < next.add.length + next.update.length) {
        const entry = next.update[at - next.add.length]!;
        if (have.get(entry.id)?.status !== "active") continue;
        const ids = entry.collections.map(collectionId);
        updateDoc(saveRef(next.uid, entry.id), {
          ...(entry.tags.length ? { tags: arrayUnion(...entry.tags) } : {}),
          ...(ids.length ? { collectionIds: arrayUnion(...ids) } : {}),
          updatedAt: now,
        }).catch(forget);
        writes++;
        next.changed++;
      } else {
        const id = next.trash[at - next.add.length - next.update.length]!;
        if (have.get(id)?.status !== "active") continue;
        trashSave(next.uid, id).catch(forget);
        writes++;
        next.changed++;
      }
    }

    if (writes > 0) writeLocal(DAY_KEY + next.uid, JSON.stringify(countWrites(readDay(next.uid), writes, Date.now())));
    if (next.cursor >= total) {
      report(next, "done");
      await removeJob(next.id).catch(forget);
      return { next, complete: true };
    }
    // Cancelled meanwhile: nothing is kept. Paused meanwhile: it stays paused.
    if (current.current?.id !== next.id) return { next, complete: false };
    next.paused = current.current.paused;
    await storeJob(next).catch(forget);
    // Reported now and then, and when today's share is used up.
    if (!next.paused && (Math.floor(next.cursor / REPORT_EVERY) !== Math.floor(from.cursor / REPORT_EVERY) || writes >= allowed)) report(next, "running");
    return { next, complete: false };
  }

  const start = useCallback(
    async (plan: ImportPlan, { trashMissing }: { trashMissing: boolean }) => {
      const fresh: ImportJob = {
        id: newCollectionId(),
        uid,
        type: plan.type,
        createdAt: Date.now(),
        add: plan.add,
        update: plan.update,
        trash: trashMissing ? plan.missing.map((s) => s.id) : [],
        cursor: 0,
        added: 0,
        changed: 0,
        collectionIds: {},
        paused: false,
      };
      if (jobTotal(fresh) === 0) {
        setFinished({ type: plan.type, added: 0, changed: 0 });
        return;
      }
      await storeJob(fresh);
      const now = serverTimestamp();
      setDoc(importRef(uid, fresh.id), { type: fresh.type, total: jobTotal(fresh), done: 0, cursor: 0, status: "running", createdAt: now, updatedAt: now }).catch(forget);
      setFinished(null);
      current.current = fresh;
      setJob(fresh);
    },
    [uid],
  );

  const setPaused = (paused: boolean) => {
    if (!job) return;
    const next = { ...job, paused };
    current.current = next;
    storeJob(next).catch(forget);
    report(next, paused ? "paused" : "running");
    setJob(next);
  };

  return {
    view: job && status ? { type: job.type, total: jobTotal(job), cursor: job.cursor, status, cap } : null,
    cap,
    finished,
    start,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    cancel: () => {
      if (!job) return;
      current.current = null;
      report(job, "cancelled");
      removeJob(job.id).catch(forget);
      setFinished({ type: job.type, added: job.added, changed: job.changed });
      setJob(null);
    },
    dismiss: () => setFinished(null),
  };
}

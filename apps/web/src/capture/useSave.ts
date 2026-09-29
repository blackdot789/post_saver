import { useEffect, useRef, useState } from "react";
import type { ParsedLink, SaveSource } from "@postsaver/core";
import { saveLink, watchSave, type LiveSave, type SaveOutcome } from "./saveLink.ts";

export interface SaveState {
  /** saving: working out what to do · pending: on this device, not yet on the server · synced · failed */
  sync: "saving" | "pending" | "synced" | "failed";
  id?: string;
  outcome?: SaveOutcome;
  savedAt?: Date;
  error?: unknown;
}

/**
 * Saves one link and follows it until the server has it. `onStored` runs once the save is in
 * the device cache (from where Firestore sends it, even after the page closes).
 */
export function useSave(uid: string, link: ParsedLink, source: SaveSource, onStored?: () => void): [SaveState, () => void] {
  const [state, setState] = useState<SaveState>({ sync: "saving" });
  const [attempt, setAttempt] = useState(0);
  const stored = useRef(onStored);
  useEffect(() => {
    stored.current = onStored;
  });

  useEffect(() => {
    let live = true;
    setState({ sync: "saving" });
    saveLink(uid, link, source).then(
      (result) => {
        if (!live) return;
        stored.current?.();
        setState({ sync: "pending", id: result.id, outcome: result.outcome, savedAt: result.savedAt });
        result.synced.then(
          (final) => live && setState((s) => ({ ...s, ...final, sync: "synced" })),
          (error: unknown) => live && setState((s) => ({ ...s, sync: "failed", error })),
        );
      },
      (error: unknown) => live && setState({ sync: "failed", error }),
    );
    return () => {
      live = false;
    };
  }, [uid, link, source, attempt]);

  return [state, () => setAttempt((n) => n + 1)];
}

/** The live copy of one save (tags, note), or null while loading or once it's gone. */
export function useLiveSave(uid: string, id: string | undefined): LiveSave | null {
  const [save, setSave] = useState<LiveSave | null>(null);
  useEffect(() => {
    if (!id) return;
    return watchSave(uid, id, setSave);
  }, [uid, id]);
  return id ? save : null;
}

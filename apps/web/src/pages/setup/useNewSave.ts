import { limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { savesOf } from "../../data/firestore.ts";
import { toLibrarySave, type LibrarySave } from "../../sync/library.ts";

const timeOf = (save: LibrarySave): number => save.createdAt?.getTime() ?? 0;

/**
 * The first post saved to this account after the page opened, from any device: the setup
 * guide's live test. One small listener on the newest save: it costs a read when it starts and
 * one per new save.
 */
export function useNewSave(uid: string): LibrarySave | null {
  const [save, setSave] = useState<LibrarySave | null>(null);

  useEffect(() => {
    // The newest save when the server first answered: undefined until then, null for "none yet".
    let baseline: { id: string; at: number } | null | undefined;
    return onSnapshot(
      query(savesOf(uid), orderBy("createdAt", "desc"), limit(1)),
      { includeMetadataChanges: true },
      (snap) => {
        const doc = snap.docs[0];
        const top = doc ? toLibrarySave(doc.id, doc.data({ serverTimestamps: "estimate" }), doc.metadata.hasPendingWrites) : null;
        if (baseline === undefined) {
          // The device's own copy may be out of date; only the server's answer is a starting point.
          if (!snap.metadata.fromCache) baseline = top ? { id: top.id, at: timeOf(top) } : null;
          return;
        }
        // A newer save, not an older one moving up because the newest was deleted.
        if (top && top.id !== baseline?.id && timeOf(top) >= (baseline?.at ?? 0)) setSave(top);
      },
      () => undefined,
    );
  }, [uid]);

  return save;
}

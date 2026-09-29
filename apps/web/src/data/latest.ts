import { limit, onSnapshot, orderBy, query } from "firebase/firestore";
import type { Kind, Platform } from "@postsaver/core";
import { savesOf } from "./firestore.ts";

// The newest saves, live, for the /app/ page until the library arrives. Step 5's sync engine
// (one delta listener over the whole library, CLAUDE.md §6.5) replaces this.

export interface SaveRow {
  id: string;
  url: string;
  platform: Platform;
  kind: Kind;
  author?: string;
  tags: string[];
  savedAt?: Date;
  /** Saved or changed on this device, not yet on the server. */
  pending: boolean;
}

export function watchLatest(uid: string, count: number, onChange: (rows: SaveRow[]) => void, onError: (e: unknown) => void) {
  const newest = query(savesOf(uid), orderBy("savedAt", "desc"), limit(count));
  return onSnapshot(
    newest,
    { includeMetadataChanges: true },
    (snap) => {
      onChange(
        snap.docs.flatMap((d) => {
          // A save made offline has no server time yet; "estimate" uses the local clock meanwhile.
          const data = d.data({ serverTimestamps: "estimate" });
          if (data.deleted || data.status !== "active") return [];
          return [
            {
              id: d.id,
              url: String(data.url),
              platform: data.platform as Platform,
              kind: data.kind as Kind,
              ...(typeof data.author === "string" ? { author: data.author } : {}),
              tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
              savedAt: data.savedAt?.toDate?.(),
              pending: d.metadata.hasPendingWrites,
            },
          ];
        }),
      );
    },
    onError,
  );
}

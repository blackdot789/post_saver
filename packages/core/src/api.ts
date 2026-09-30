// The resolver Worker's contract (CLAUDE.md §6.3), shared by the Worker and the app.

/** What the Worker can add to a saved link. Every field is optional: often there's nothing. */
export interface LinkMeta {
  title?: string;
  author?: string;
  /** Only from hosts whose image URLs don't expire (STABLE_THUMB_PREFIX). */
  thumb?: string;
}

/** One thing to do in a POST /batch call. */
export interface BatchItem {
  url: string;
  /** resolve: where a short link leads · meta: a title and author for a link */
  do: "resolve" | "meta";
}

export type BatchResult =
  | { url: string; do: "resolve"; ok: true; finalUrl: string }
  | { url: string; do: "meta"; ok: true; meta: LinkMeta }
  /** `retry`: a later try might work (the platform didn't answer, or the call ran out of requests). */
  | { url: string; do: "resolve" | "meta"; ok: false; error: string; retry: boolean };

/** The most items one POST /batch call takes. */
export const MAX_BATCH = 40;

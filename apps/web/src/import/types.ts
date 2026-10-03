// Importing saves from files (CLAUDE.md §6.1): what every parser hands to the planner.

/** Where a file came from. Saves get the source `import-<type>`. */
export type ImportType = "bookmarks" | "csv" | "dewey" | "instagram" | "backup";

export const IMPORT_NAMES: Record<ImportType, string> = {
  bookmarks: "browser bookmarks",
  csv: "a CSV file",
  dewey: "a Dewey export",
  instagram: "an Instagram export",
  backup: "an export of this app",
};

/** One link found in a file, with whatever the file says about it. */
export interface ImportItem {
  /** The link; empty when the entry is a saved text. */
  url: string;
  /** A saved text (only this app's own export has them). */
  text?: string;
  /** When it was saved, in ms since 1970, if the file says. */
  savedAt?: number;
  title?: string;
  tags?: string[];
  note?: string;
  /** Names of the folders or collections it was in. */
  collections?: string[];
  /** Its category (only this app's own export has one). */
  category?: { name: string; symbol?: string };
  favorite?: boolean;
}

export interface ParsedFile {
  type: ImportType;
  items: ImportItem[];
  /** Rows or entries without a usable link. */
  skipped: number;
}

/** The file can't be imported; `message` is written for the person who picked it. */
export class ImportError extends Error {}

const HOUR = 3600_000;

/**
 * A date from a file as ms since 1970: an ISO or other parseable date, or a number of seconds
 * or milliseconds. Undefined when it isn't a sensible date (before 2000, or in the future).
 */
export function toTime(value: unknown, now = Date.now()): number | undefined {
  let ms: number;
  if (typeof value === "number") ms = value;
  else if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    ms = /^\d{9,17}$/.test(text) ? Number(text) : Date.parse(text);
  } else return undefined;
  if (!Number.isFinite(ms)) return undefined;
  // Seconds (10 digits until 2286), microseconds (16 digits, as Chrome's bookmark files use).
  if (ms < 1e11) ms *= 1000;
  else if (ms > 1e14) ms /= 1000;
  return ms >= Date.UTC(2000, 0, 1) && ms <= now + HOUR ? Math.round(ms) : undefined;
}

/** A tag or folder list written in one cell: split on commas, semicolons and bars. */
export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

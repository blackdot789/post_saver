import { readLocal, writeLocal } from "../lib/storage.ts";
import type { PreviewSize } from "./sizing.ts";

// Frames load a few at a time, and their sizes are remembered, so the library doesn't jump
// around or open twenty platform embeds at once (CLAUDE.md §6.6).

/** How many embed frames may be loading at the same time. */
export const MAX_LOADING = 3;

const waiting: Array<() => void> = [];
let loading = 0;

/**
 * Resolves when a slot is free. The caller must call the returned function once its frame has
 * loaded, failed or gone away; calling it again does nothing.
 */
export function acquireSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      loading--;
      waiting.shift()?.();
    };
    const start = () => {
      loading++;
      resolve(release);
    };
    if (loading < MAX_LOADING) start();
    else waiting.push(start);
  });
}

const SIZE_KEY = "ps:embed-sizes";
const MAX_REMEMBERED = 500;
/** A size measured in a card this much wider or narrower says little about this one. */
const WIDTH_TOLERANCE = 24;

/** id → [height, fold or 0, the card's width] */
type Stored = Record<string, [number, number, number]>;

let cache: Stored | null = null;

function sizes(): Stored {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(readLocal(SIZE_KEY) ?? "{}");
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stored) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** The size an embed had last time in a card about this wide, so the card can keep the space. */
export function rememberedSize(id: string, width: number): PreviewSize | undefined {
  const entry = sizes()[id];
  if (!Array.isArray(entry)) return undefined;
  const [height, fold, at] = entry;
  if (typeof height !== "number" || !(height > 0) || typeof at !== "number" || Math.abs(at - width) > WIDTH_TOLERANCE) return undefined;
  return typeof fold === "number" && fold > 0 ? { height, fold } : { height };
}

export function rememberSize(id: string, size: PreviewSize, width: number): void {
  const all = sizes();
  const next: [number, number, number] = [Math.round(size.height), Math.round(size.fold ?? 0), Math.round(width)];
  const before = all[id];
  if (before && before[0] === next[0] && before[1] === next[1] && before[2] === next[2]) return;
  // Re-inserted, so the oldest entries are the ones dropped.
  delete all[id];
  all[id] = next;
  const keys = Object.keys(all);
  if (keys.length > MAX_REMEMBERED) for (const key of keys.slice(0, keys.length - MAX_REMEMBERED)) delete all[key];
  writeLocal(SIZE_KEY, JSON.stringify(all));
}

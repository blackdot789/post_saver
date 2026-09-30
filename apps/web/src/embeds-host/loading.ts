import { readLocal, writeLocal } from "../lib/storage.ts";

// Frames load a few at a time, and their heights are remembered, so the library doesn't jump
// around or open twenty platform embeds at once (CLAUDE.md §6.6).

/** How many embed frames may be loading at the same time. */
export const MAX_LOADING = 3;

const waiting: Array<() => void> = [];
let loading = 0;

/** Resolves when a slot is free. The caller must call the returned function when done. */
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

const HEIGHT_KEY = "ps:embed-heights";
const MAX_REMEMBERED = 500;

function heights(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(readLocal(HEIGHT_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** The height an embed had last time, so its card can reserve the space. */
export function rememberedHeight(id: string): number | undefined {
  const h = heights()[id];
  return typeof h === "number" && h > 0 ? h : undefined;
}

export function rememberHeight(id: string, height: number): void {
  const all = heights();
  all[id] = Math.round(height);
  const keys = Object.keys(all);
  if (keys.length > MAX_REMEMBERED) for (const key of keys.slice(0, keys.length - MAX_REMEMBERED)) delete all[key];
  writeLocal(HEIGHT_KEY, JSON.stringify(all));
}

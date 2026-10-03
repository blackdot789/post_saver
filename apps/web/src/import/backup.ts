import { toTime, type ImportItem, type ParsedFile } from "./types.ts";

// This app's own JSON export (export/build.ts), so an export can be brought back, or moved to
// another account. Saved texts come back too.

export const BACKUP_APP = "postsaver";

export function isBackup(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { app?: unknown }).app === BACKUP_APP && Array.isArray((data as { saves?: unknown }).saves);
}

/** A save's category as export/build.ts writes it: its name and symbol. */
function categoryIn(value: unknown): { name: string; symbol?: string } | undefined {
  const c = value as { name?: unknown; symbol?: unknown } | null;
  if (!c || typeof c.name !== "string" || !c.name.trim()) return undefined;
  return { name: c.name, ...(typeof c.symbol === "string" && c.symbol ? { symbol: c.symbol } : {}) };
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : []);

export function parseBackup(data: unknown, now = Date.now()): ParsedFile {
  const items: ImportItem[] = [];
  let skipped = 0;
  for (const entry of (data as { saves: unknown[] }).saves) {
    const save = entry as Record<string, unknown> | null;
    const text = typeof save?.text === "string" && save.text.trim() ? save.text : undefined;
    const url = text === undefined && typeof save?.url === "string" ? save.url : undefined;
    // What was in the Trash stays out.
    if (!save || (!url && text === undefined) || save.status === "trashed") {
      skipped++;
      continue;
    }
    const savedAt = toTime(save.savedAt, now);
    const tags = strings(save.tags);
    const collections = strings(save.collections);
    const category = categoryIn(save.category);
    items.push({
      url: url ?? "",
      ...(text !== undefined ? { text } : {}),
      ...(savedAt ? { savedAt } : {}),
      ...(typeof save.title === "string" && save.title ? { title: save.title } : {}),
      ...(tags.length ? { tags } : {}),
      ...(typeof save.note === "string" && save.note ? { note: save.note } : {}),
      ...(collections.length ? { collections } : {}),
      ...(category ? { category } : {}),
      ...(save.favorite === true ? { favorite: true } : {}),
    });
  }
  return { type: "backup", items, skipped };
}

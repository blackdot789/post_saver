import { toTime, type ImportItem, type ParsedFile } from "./types.ts";

// This app's own JSON export (export/build.ts), so an export can be brought back, or moved to
// another account.

export const BACKUP_APP = "postsaver";

export function isBackup(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { app?: unknown }).app === BACKUP_APP && Array.isArray((data as { saves?: unknown }).saves);
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : []);

export function parseBackup(data: unknown, now = Date.now()): ParsedFile {
  const items: ImportItem[] = [];
  let skipped = 0;
  for (const entry of (data as { saves: unknown[] }).saves) {
    const save = entry as Record<string, unknown> | null;
    const url = typeof save?.url === "string" ? save.url : undefined;
    // What was in the Trash stays out.
    if (!save || !url || save.status === "trashed") {
      skipped++;
      continue;
    }
    const savedAt = toTime(save.savedAt, now);
    const tags = strings(save.tags);
    const collections = strings(save.collections);
    items.push({
      url,
      ...(savedAt ? { savedAt } : {}),
      ...(typeof save.title === "string" && save.title ? { title: save.title } : {}),
      ...(tags.length ? { tags } : {}),
      ...(typeof save.note === "string" && save.note ? { note: save.note } : {}),
      ...(collections.length ? { collections } : {}),
      ...(save.favorite === true ? { favorite: true } : {}),
    });
  }
  return { type: "backup", items, skipped };
}

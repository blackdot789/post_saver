import { TEXT_PLATFORM } from "@postsaver/core";
import type { Collection } from "../data/collections.ts";
import { BACKUP_APP } from "../import/backup.ts";
import { describeLink, displayHost } from "../lib/platforms.ts";
import type { LibrarySave } from "../sync/library.ts";

// Export (CLAUDE.md §6.8): the library as files people can keep or take elsewhere. Built on the
// device from the library's own copy; nothing is sent anywhere.
// - JSON: everything, saved texts included, in a form this app imports again (import/backup.ts).
// - CSV: for spreadsheets; this app's CSV import reads the links back too.
// - Bookmarks HTML: for any browser or bookmarking service (links only: a text has no address).

export const EXPORT_VERSION = 1;

type Names = ReadonlyMap<string, string>;
const namesOf = (collections: readonly Collection[]): Names => new Map(collections.map((c) => [c.id, c.name]));
const collectionNames = (save: LibrarySave, names: Names): string[] => save.collectionIds.map((id) => names.get(id)).filter((n): n is string => !!n);
/** Newest first, like the library. */
const ordered = (saves: readonly LibrarySave[]) => [...saves].sort((a, b) => (b.savedAt?.getTime() ?? 0) - (a.savedAt?.getTime() ?? 0));

export function toJson(saves: readonly LibrarySave[], collections: readonly Collection[], now: Date): string {
  const names = namesOf(collections);
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      saves: ordered(saves).map((s) => ({
        ...(s.platform === TEXT_PLATFORM ? { text: s.text, platform: s.platform } : { url: s.url, originalUrl: s.originalUrl, platform: s.platform, kind: s.kind }),
        ...(s.author ? { author: s.author } : {}),
        ...(s.title ? { title: s.title } : {}),
        ...(s.note ? { note: s.note } : {}),
        tags: s.tags,
        collections: collectionNames(s, names),
        favorite: s.favorite,
        status: s.status,
        ...(s.savedAt ? { savedAt: s.savedAt.toISOString() } : {}),
        source: s.source,
      })),
      collections: collections.map((c) => ({ name: c.name, ...(c.emoji ? { emoji: c.emoji } : {}), ...(c.color ? { color: c.color } : {}) })),
    },
    null,
    2,
  );
}

/** A CSV cell. Text that a spreadsheet would run as a formula gets an apostrophe in front. */
function cell(value: string, text = true): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_HEADINGS = ["url", "title", "platform", "author", "tags", "note", "collections", "favorite", "saved at", "text"];

/** The saves that aren't in the Trash, one per row. */
export function toCsv(saves: readonly LibrarySave[], collections: readonly Collection[]): string {
  const names = namesOf(collections);
  const rows = ordered(saves)
    .filter((s) => s.status === "active")
    .map((s) =>
      [
        cell(s.url, false),
        cell(s.title ?? ""),
        cell(s.platform),
        cell(s.author ?? ""),
        cell(s.tags.join("; ")),
        cell(s.note ?? ""),
        cell(collectionNames(s, names).join(" | ")),
        s.favorite ? "yes" : "",
        s.savedAt ? s.savedAt.toISOString() : "",
        cell(s.text ?? ""),
      ].join(","),
    );
  return `${[CSV_HEADINGS.join(","), ...rows].join("\r\n")}\r\n`;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function bookmark(save: LibrarySave): string {
  const title = save.title || `${describeLink(save)} · ${displayHost(save.url)}`;
  const date = save.savedAt ? ` ADD_DATE="${Math.floor(save.savedAt.getTime() / 1000)}"` : "";
  const tags = save.tags.length ? ` TAGS="${escapeHtml(save.tags.join(","))}"` : "";
  return `<DT><A HREF="${escapeHtml(save.url)}"${date}${tags}>${escapeHtml(title)}</A>`;
}

/**
 * A browser bookmarks file: one folder named `folder`, with a folder per collection inside it
 * (a save in two collections appears in both) and the rest directly in it.
 */
export function toBookmarksHtml(saves: readonly LibrarySave[], collections: readonly Collection[], folder: string): string {
  const active = ordered(saves).filter((s) => s.status === "active" && s.platform !== TEXT_PLATFORM);
  const names = namesOf(collections);
  const lines: string[] = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>${escapeHtml(folder)}</TITLE>`,
    `<H1>${escapeHtml(folder)}</H1>`,
    "<DL><p>",
    `    <DT><H3>${escapeHtml(folder)}</H3>`,
    "    <DL><p>",
  ];
  for (const collection of collections) {
    const inside = active.filter((s) => s.collectionIds.includes(collection.id));
    if (inside.length === 0) continue;
    lines.push(`        <DT><H3>${escapeHtml(collection.name)}</H3>`, "        <DL><p>");
    for (const save of inside) lines.push(`            ${bookmark(save)}`);
    lines.push("        </DL><p>");
  }
  for (const save of active) if (collectionNames(save, names).length === 0) lines.push(`        ${bookmark(save)}`);
  lines.push("    </DL><p>", "</DL><p>", "");
  return lines.join("\n");
}

export type ExportFormat = "json" | "csv" | "html";

const MIME: Record<ExportFormat, string> = { json: "application/json", csv: "text/csv", html: "text/html" };

/** The file for a format: its name (with today's date), type and content. */
export function buildExport(format: ExportFormat, saves: readonly LibrarySave[], collections: readonly Collection[], folder: string, now = new Date()): { name: string; mime: string; content: string } {
  const content = format === "json" ? toJson(saves, collections, now) : format === "csv" ? toCsv(saves, collections) : toBookmarksHtml(saves, collections, folder);
  // A BOM, so spreadsheets read accents in the CSV correctly.
  return { name: `${BACKUP_APP}-export-${now.toISOString().slice(0, 10)}.${format}`, mime: `${MIME[format]};charset=utf-8`, content: format === "csv" ? `﻿${content}` : content };
}

/** Hands a file to the browser's download. */
export function download(file: { name: string; mime: string; content: string }): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

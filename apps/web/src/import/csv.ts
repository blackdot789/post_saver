import { splitList, toTime, type ImportItem, type ParsedFile } from "./types.ts";

// CSV files: a plain list of links, a spreadsheet export, another service's export (Dewey's
// among them). Columns are found by their headings, whatever their order.

/** Splits CSV text into rows of cells: quoted cells, doubled quotes, line breaks inside quotes. */
export function parseCsv(content: string, delimiter = detectDelimiter(content)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = content.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(content: string): string {
  const firstLine = content.slice(0, 5000).split(/\r?\n/)[0] ?? "";
  const count = (d: string) => firstLine.split(d).length - 1;
  return [",", ";", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

const norm = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Headings, in order of preference. Dates of the post itself ("tweet date", "published") are
// deliberately not here: only when it was saved counts.
const COLUMNS = {
  url: ["url", "link", "post url", "tweet url", "permalink", "href", "address", "post link", "source url", "web address"],
  title: ["title", "name", "page title"],
  tags: ["tags", "tag", "labels"],
  note: ["note", "notes", "my notes", "comment", "comments", "annotation", "description"],
  date: ["saved at", "saved", "date saved", "saved on", "bookmarked at", "bookmarked", "added", "added at", "date added", "created", "created at", "date", "timestamp", "time"],
  collections: ["folder", "folders", "collection", "collections", "board", "list"],
  favorite: ["favorite", "favourite", "starred"],
} as const;

type Column = keyof typeof COLUMNS;

/** Headings only Dewey's export has. */
const DEWEY_HEADINGS = ["tweet url", "posted by", "my notes", "tweet content", "posted by twitter handle"];

const looksLikeUrl = (cell: string | undefined) => /^\s*(https?:\/\/|www\.)\S+/i.test(cell ?? "");

export function parseCsvFile(content: string, now = Date.now()): ParsedFile {
  const rows = parseCsv(content);
  const first = rows[0];
  if (!first) return { type: "csv", items: [], skipped: 0 };

  // No heading row when the first row already holds a link.
  const hasHeadings = !first.some(looksLikeUrl);
  const headings = hasHeadings ? first.map(norm) : [];
  const find = (column: Column): number => {
    for (const name of COLUMNS[column]) {
      const at = headings.indexOf(name);
      if (at >= 0) return at;
    }
    return -1;
  };
  const data = hasHeadings ? rows.slice(1) : rows;
  let urlAt = find("url");
  // No heading we know: the first column that holds links.
  if (urlAt < 0) urlAt = (data[0] ?? []).findIndex(looksLikeUrl);
  const at = { title: find("title"), tags: find("tags"), note: find("note"), date: find("date"), collections: find("collections"), favorite: find("favorite") };
  const type = DEWEY_HEADINGS.some((h) => headings.includes(h)) ? "dewey" : "csv";

  const items: ImportItem[] = [];
  let skipped = 0;
  for (const row of data) {
    const cell = (index: number) => (index >= 0 ? row[index]?.trim() : undefined) || undefined;
    const url = cell(urlAt);
    if (urlAt < 0 || !url || !looksLikeUrl(url)) {
      skipped++;
      continue;
    }
    const savedAt = toTime(cell(at.date), now);
    const tags = splitList(cell(at.tags)).map((t) => t.replace(/^#/, ""));
    const collections = splitList(cell(at.collections));
    const title = cell(at.title);
    const note = cell(at.note);
    items.push({
      url,
      ...(savedAt ? { savedAt } : {}),
      ...(title ? { title } : {}),
      ...(tags.length ? { tags } : {}),
      ...(note ? { note } : {}),
      ...(collections.length ? { collections } : {}),
      ...(/^(true|yes|1|y)$/i.test(cell(at.favorite) ?? "") ? { favorite: true } : {}),
    });
  }
  return { type, items, skipped };
}

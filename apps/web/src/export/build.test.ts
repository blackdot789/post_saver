import { describe, expect, it } from "vitest";
import type { Collection } from "../data/collections.ts";
import { parseBookmarks } from "../import/bookmarks.ts";
import { parseCsvFile } from "../import/csv.ts";
import { readImportFile } from "../import/read.ts";
import { toLibrarySave, type LibrarySave, type LinkSave } from "../sync/library.ts";
import { buildExport, toBookmarksHtml, toCsv, toJson } from "./build.ts";

const NOW = new Date(Date.UTC(2026, 8, 30, 12));

function save(over: Partial<LinkSave> & { id: string; url: string }): LinkSave {
  return {
    originalUrl: over.url,
    platform: "web",
    kind: "link",
    platformId: null,
    tags: [],
    collectionIds: [],
    favorite: false,
    status: "active",
    source: "web",
    embedStatus: "unknown",
    needsResolve: false,
    needsMeta: false,
    schemaVersion: 1,
    pending: false,
    ...over,
  };
}

const collections: Collection[] = [
  { id: "c1", name: "Recipes", order: 0, pending: false },
  { id: "c2", name: "Trips & <more>", emoji: "✈️", order: 1, pending: false },
];
const saves = [
  save({ id: "a", url: "https://example.com/pasta?x=1&y=2", title: 'Pasta, "quick"', note: "Line one\nLine two", tags: ["dinner", "quick"], collectionIds: ["c1", "c2"], favorite: true, savedAt: new Date(Date.UTC(2025, 2, 4, 5, 6, 7)) }),
  save({ id: "b", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", platform: "youtube", kind: "video", author: "Rick Astley", title: "=HYPERLINK(1)", savedAt: new Date(Date.UTC(2026, 0, 1)), collectionIds: ["gone"] }),
  save({ id: "c", url: "https://x.com/jack/status/20", platform: "x", kind: "post", author: "jack", status: "trashed", savedAt: new Date(Date.UTC(2024, 0, 1)) }),
];

const text: LibrarySave = {
  ...toLibrarySave("text_0123456789abcdef01234567", { text: 'Gate code 4821#\n=SUM(1), "then" left', platform: "text", tags: ["home"], collectionIds: ["c1"], favorite: true, status: "active", source: "paste", note: "Front gate" }, false),
  savedAt: new Date(Date.UTC(2026, 5, 1)),
};

describe("exporting saved texts", () => {
  const all = [...saves, text];

  it("JSON carries them, and this app imports them again", async () => {
    const json = toJson(all, collections, NOW);
    const data = JSON.parse(json) as { saves: Array<Record<string, unknown>> };
    expect(data.saves[0]).toEqual({
      text: 'Gate code 4821#\n=SUM(1), "then" left',
      platform: "text",
      note: "Front gate",
      tags: ["home"],
      collections: ["Recipes"],
      favorite: true,
      status: "active",
      savedAt: "2026-06-01T00:00:00.000Z",
      source: "paste",
    });
    const back = await readImportFile(new File([json], "export.json"), NOW.getTime());
    expect(back.items[0]).toEqual({
      url: "",
      text: 'Gate code 4821#\n=SUM(1), "then" left',
      savedAt: Date.UTC(2026, 5, 1),
      tags: ["home"],
      note: "Front gate",
      collections: ["Recipes"],
      favorite: true,
    });
  });

  it("CSV has them in a column of their own, defused like any other cell", () => {
    const csv = toCsv(all, collections);
    expect(csv.split("\r\n")[0]).toBe("url,title,platform,author,tags,note,collections,favorite,saved at,text");
    expect(csv).toContain(`,text,,home,Front gate,Recipes,yes,2026-06-01T00:00:00.000Z,"Gate code 4821#\n=SUM(1), ""then"" left"`);
    // Reading the CSV back brings the links; a text has no link to import.
    const back = parseCsvFile(csv, NOW.getTime());
    expect(back.items.map((i) => i.url)).not.toContain("");
    expect(back.items).toHaveLength(2);
  });

  it("the bookmarks file leaves them out: a text has no address", () => {
    const html = toBookmarksHtml(all, collections, "My saves");
    expect(html).not.toContain("Gate code");
    expect(html).toBe(toBookmarksHtml(saves, collections, "My saves"));
  });
});

describe("export", () => {
  it("JSON holds everything, newest first, and this app imports it again", async () => {
    const json = toJson(saves, collections, NOW);
    const data = JSON.parse(json) as { app: string; saves: Array<Record<string, unknown>>; collections: unknown[] };
    expect(data).toMatchObject({ app: "postsaver", version: 1, exportedAt: "2026-09-30T12:00:00.000Z" });
    expect(data.saves.map((s) => s.url)).toEqual([saves[1]!.url, saves[0]!.url, saves[2]!.url]);
    expect(data.saves[1]).toMatchObject({ collections: ["Recipes", "Trips & <more>"], favorite: true, status: "active", savedAt: "2025-03-04T05:06:07.000Z" });
    expect(data.collections).toEqual([{ name: "Recipes" }, { name: "Trips & <more>", emoji: "✈️" }]);

    const back = await readImportFile(new File([json], "export.json"), NOW.getTime());
    expect(back.type).toBe("backup");
    // The trashed save stays out.
    expect(back.skipped).toBe(1);
    expect(back.items[1]).toEqual({
      url: "https://example.com/pasta?x=1&y=2",
      savedAt: Date.UTC(2025, 2, 4, 5, 6, 7),
      title: 'Pasta, "quick"',
      tags: ["dinner", "quick"],
      note: "Line one\nLine two",
      collections: ["Recipes", "Trips & <more>"],
      favorite: true,
    });
  });

  it("CSV quotes what needs quoting, defuses formulas, leaves out the Trash, and reads back", () => {
    const csv = toCsv(saves, collections);
    expect(csv.split("\r\n")[0]).toBe("url,title,platform,author,tags,note,collections,favorite,saved at,text");
    expect(csv).toContain(`"Pasta, ""quick"""`);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).not.toContain("x.com/jack");
    const back = parseCsvFile(csv, NOW.getTime());
    expect(back.items).toHaveLength(2);
    expect(back.items[1]).toEqual({
      url: "https://example.com/pasta?x=1&y=2",
      savedAt: Date.UTC(2025, 2, 4, 5, 6, 7),
      title: 'Pasta, "quick"',
      tags: ["dinner", "quick"],
      note: "Line one\nLine two",
      collections: ["Recipes", "Trips & <more>"],
      favorite: true,
    });
  });

  it("the bookmarks file has a folder per collection, escapes text, and reads back", () => {
    const html = toBookmarksHtml(saves, collections, "My saves");
    expect(html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
    expect(html).toContain("<DT><H3>Trips &amp; &lt;more&gt;</H3>");
    expect(html).toContain('HREF="https://example.com/pasta?x=1&amp;y=2" ADD_DATE="1741064767" TAGS="dinner,quick"');
    const back = parseBookmarks(html, NOW.getTime());
    // The pasta page is in two folders; the video, in no collection that still exists, sits outside them.
    expect(back.items.map((i) => [i.url, i.collections?.[0]])).toEqual([
      ["https://example.com/pasta?x=1&y=2", "Recipes"],
      ["https://example.com/pasta?x=1&y=2", "Trips & <more>"],
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "My saves"],
    ]);
  });

  it("names the file after the day and gives the CSV a byte-order mark", () => {
    const file = buildExport("csv", saves, collections, "My saves", NOW);
    expect(file.name).toBe("postsaver-export-2026-09-30.csv");
    expect(file.content.startsWith("﻿url,")).toBe(true);
    expect(buildExport("json", saves, collections, "My saves", NOW).name).toBe("postsaver-export-2026-09-30.json");
    expect(buildExport("html", saves, collections, "My saves", NOW).mime).toBe("text/html;charset=utf-8");
  });
});

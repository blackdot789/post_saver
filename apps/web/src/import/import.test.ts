import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { LibrarySave } from "../sync/library.ts";
import { parseBookmarks } from "./bookmarks.ts";
import { parseCsv, parseCsvFile } from "./csv.ts";
import { fixEncoding, parseInstagramFiles } from "./instagram.ts";
import { countWrites, leftToday, MAX_NEW_COLLECTIONS, pacificDay, planImport } from "./plan.ts";
import { readImportFile } from "./read.ts";
import { ImportError, toTime } from "./types.ts";

const NOW = Date.UTC(2026, 8, 30, 12);
const file = (name: string, content: string | Uint8Array) => new File([content as BlobPart], name);

function save(over: Partial<LibrarySave> & { id: string }): LibrarySave {
  return {
    url: `https://example.com/${over.id}`,
    originalUrl: `https://example.com/${over.id}`,
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

// ---------- files ----------

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://www.youtube.com/watch?v=dQw4w9WgXcQ" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">Rick Astley &amp; friends</A>
        <DT><H3 ADD_DATE="1700000200">Recipes</H3>
        <DL><p>
            <DT><A HREF="https://example.com/pasta?x=1&amp;y=2" ADD_DATE="1700000300" TAGS="dinner, Quick">Pasta</A>
            <DT><A HREF="javascript:alert(1)">A bookmarklet</A>
        </DL><p>
        <DT><A HREF="https://x.com/jack/status/20">https://x.com/jack/status/20</A>
    </DL><p>
    <DT><A HREF="place:sort=8">Most visited</A>
</DL><p>`;

const INSTAGRAM_POSTS = {
  saved_saved_media: [
    { title: "natgeo", string_map_data: { "Saved on": { href: "https://www.instagram.com/reel/C8xYz12AbCd/", timestamp: 1_758_000_000 } } },
    { title: "chef", string_map_data: { "Saved on": { href: "https://www.instagram.com/p/CabcDEF1234/", timestamp: 1_757_000_000 } } },
    { title: "gone", string_map_data: { "Saved on": { timestamp: 1_756_000_000 } } },
  ],
};
const INSTAGRAM_COLLECTIONS = {
  saved_saved_collections: [
    { title: "Collection", string_map_data: { Name: { value: "CafÃ©s" }, "Creation Time": { timestamp: 1_750_000_000 }, "Update Time": { timestamp: 1_758_000_000 } } },
    { string_map_data: { Name: { value: "chef", href: "https://www.instagram.com/p/CabcDEF1234/" }, "Added Time": { timestamp: 1_757_500_000 } } },
    { string_map_data: { Name: { value: "deleted_account" }, "Added Time": { timestamp: 1_757_400_000 } } },
    { title: "Collection", string_map_data: { Name: { value: "Trips" }, "Creation Time": { timestamp: 1_751_000_000 } } },
    { string_map_data: { Name: { value: "natgeo", href: "https://www.instagram.com/natgeo/reel/C8xYz12AbCd/" }, "Added Time": { timestamp: 1_758_100_000 } } },
    { string_map_data: { Name: { value: "chef", href: "https://www.instagram.com/p/CabcDEF1234/" }, "Added Time": { timestamp: 1_757_600_000 } } },
  ],
};

describe("dates and lists in files", () => {
  it("reads seconds, milliseconds, microseconds and written dates; refuses nonsense", () => {
    expect(toTime(1_700_000_000, NOW)).toBe(1_700_000_000_000);
    expect(toTime("1700000000000", NOW)).toBe(1_700_000_000_000);
    expect(toTime("1700000000000000", NOW)).toBe(1_700_000_000_000);
    expect(toTime("2025-03-04T05:06:07Z", NOW)).toBe(Date.UTC(2025, 2, 4, 5, 6, 7));
    expect(toTime("not a date", NOW)).toBeUndefined();
    expect(toTime("", NOW)).toBeUndefined();
    expect(toTime(undefined, NOW)).toBeUndefined();
    // Before 2000, or in the future: not a save date.
    expect(toTime(900_000_000, NOW)).toBeUndefined();
    expect(toTime("2031-01-01", NOW)).toBeUndefined();
  });
});

describe("browser bookmarks", () => {
  it("reads links, dates, tags and the folder they're in; skips what isn't a web link", () => {
    expect(parseBookmarks(BOOKMARKS, NOW)).toEqual({
      type: "bookmarks",
      skipped: 2,
      items: [
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", savedAt: 1_700_000_100_000, title: "Rick Astley & friends" },
        { url: "https://example.com/pasta?x=1&y=2", savedAt: 1_700_000_300_000, title: "Pasta", tags: ["dinner", "Quick"], collections: ["Recipes"] },
        // A title that's only the link is no title; the browser's own folders are no collection.
        { url: "https://x.com/jack/status/20" },
      ],
    });
  });
});

describe("CSV", () => {
  it("splits rows with quotes, doubled quotes, line breaks in cells and a BOM", () => {
    expect(parseCsv('﻿a,"b ""quoted""","multi\nline"\r\n1,2,3\n\n')).toEqual([
      ["a", 'b "quoted"', "multi\nline"],
      ["1", "2", "3"],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("finds columns by their headings, in any order", () => {
    const csv = `Title,Saved At,URL,Tags,Notes,Folder,Favorite
"Pasta, quick",2025-03-04T05:06:07Z,https://example.com/pasta,"dinner; #quick",Try it,Recipes|Italian,yes
No link here,2025-01-01,,,,,
,,https://x.com/jack/status/20,,,,`;
    expect(parseCsvFile(csv, NOW)).toEqual({
      type: "csv",
      skipped: 1,
      items: [
        { url: "https://example.com/pasta", savedAt: Date.UTC(2025, 2, 4, 5, 6, 7), title: "Pasta, quick", tags: ["dinner", "quick"], note: "Try it", collections: ["Recipes", "Italian"], favorite: true },
        { url: "https://x.com/jack/status/20" },
      ],
    });
  });

  it("reads a plain list of links, one per line, without headings", () => {
    const parsed = parseCsvFile("https://example.com/a\nhttps://example.com/b\nnot a link\n", NOW);
    expect(parsed.items.map((i) => i.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(parsed.skipped).toBe(1);
  });

  it("recognises Dewey's export, and doesn't take the post's date for the save date", () => {
    const csv = `Tweet Date,Posted By,Posted By Twitter Handle,Tweet URL,Tweet Content,My Notes,Tags,Folder
2021-05-06,Jack,@jack,https://twitter.com/jack/status/20,just setting up my twttr,First!,history,Classics`;
    expect(parseCsvFile(csv, NOW)).toEqual({
      type: "dewey",
      skipped: 0,
      items: [{ url: "https://twitter.com/jack/status/20", tags: ["history"], note: "First!", collections: ["Classics"] }],
    });
  });
});

describe("Instagram export", () => {
  const files = new Map([
    ["your_instagram_activity/saved/saved_posts.json", JSON.stringify(INSTAGRAM_POSTS)],
    ["your_instagram_activity/saved/saved_collections.json", JSON.stringify(INSTAGRAM_COLLECTIONS)],
  ]);

  it("repairs Instagram's mangled accents and leaves other text alone", () => {
    expect(fixEncoding("CafÃ©s")).toBe("Cafés");
    expect(fixEncoding("Plain")).toBe("Plain");
    expect(fixEncoding("Déjà")).toBe("Déjà");
    expect(fixEncoding("日本")).toBe("日本");
  });

  it("reads saved posts with their dates, and collections as a heading followed by its posts", () => {
    const parsed = parseInstagramFiles(files, NOW);
    expect(parsed.type).toBe("instagram");
    // One saved post without a link, one collection entry without a link.
    expect(parsed.skipped).toBe(2);
    expect(parsed.items).toEqual([
      { url: "https://www.instagram.com/reel/C8xYz12AbCd/", savedAt: 1_758_000_000_000 },
      { url: "https://www.instagram.com/p/CabcDEF1234/", savedAt: 1_757_000_000_000 },
      { url: "https://www.instagram.com/p/CabcDEF1234/", savedAt: 1_757_500_000_000, collections: ["Cafés"] },
      { url: "https://www.instagram.com/natgeo/reel/C8xYz12AbCd/", savedAt: 1_758_100_000_000, collections: ["Trips"] },
      { url: "https://www.instagram.com/p/CabcDEF1234/", savedAt: 1_757_600_000_000, collections: ["Trips"] },
    ]);
  });

  it("survives a layout it hasn't seen: other key names, a bare list", () => {
    const odd = [{ media: { link: "https://www.instagram.com/p/CabcDEF1234/", saved_time: 1_757_000_000 } }, { nothing: true }];
    expect(parseInstagramFiles(new Map([["saved_posts.json", JSON.stringify(odd)]]), NOW)).toEqual({
      type: "instagram",
      skipped: 1,
      items: [{ url: "https://www.instagram.com/p/CabcDEF1234/", savedAt: 1_757_000_000_000 }],
    });
    expect(parseInstagramFiles(new Map([["saved_posts.json", "{broken"]]), NOW).items).toEqual([]);
  });

  it("reads the HTML form of the export", () => {
    const html = `<a target="_blank" href="https://www.instagram.com/reel/C8xYz12AbCd/">link</a><a href="https://www.instagram.com/natgeo/">profile</a><a href="https://www.instagram.com/reel/C8xYz12AbCd/">again</a>`;
    expect(parseInstagramFiles(new Map([["saved_posts.html", html]]), NOW).items).toEqual([{ url: "https://www.instagram.com/reel/C8xYz12AbCd/" }]);
  });
});

describe("picking a file", () => {
  it("unpacks only the saved-posts files from an Instagram ZIP", async () => {
    const zip = zipSync({
      "your_instagram_activity/saved/saved_posts.json": strToU8(JSON.stringify(INSTAGRAM_POSTS)),
      "your_instagram_activity/saved/saved_collections.json": strToU8(JSON.stringify(INSTAGRAM_COLLECTIONS)),
      "your_instagram_activity/messages/inbox/chat/message_1.json": strToU8(JSON.stringify({ saved_saved_media: [{ x: "https://www.instagram.com/p/NotThisOne1/" }] })),
      "media/posts/202401/photo.jpg": new Uint8Array(50_000).fill(7),
    });
    const parsed = await readImportFile(file("instagram-export.zip", zip), NOW);
    expect(parsed.type).toBe("instagram");
    expect(parsed.items).toHaveLength(5);
    expect(JSON.stringify(parsed.items)).not.toContain("NotThisOne1");
  });

  it("tells the kinds of file apart by what's in them, not by their names", async () => {
    expect((await readImportFile(file("x.txt", BOOKMARKS), NOW)).type).toBe("bookmarks");
    expect((await readImportFile(file("x.txt", "url\nhttps://example.com/a"), NOW)).type).toBe("csv");
    expect((await readImportFile(file("saved_posts.json", JSON.stringify(INSTAGRAM_POSTS)), NOW)).type).toBe("instagram");
    const backup = { app: "postsaver", version: 1, saves: [{ url: "https://example.com/a", savedAt: "2025-03-04T05:06:07.000Z", tags: ["t"], collections: ["C"], favorite: true, note: "n" }, { url: "https://example.com/b", status: "trashed" }] };
    expect(await readImportFile(file("export.json", JSON.stringify(backup)), NOW)).toEqual({
      type: "backup",
      skipped: 1,
      items: [{ url: "https://example.com/a", savedAt: Date.UTC(2025, 2, 4, 5, 6, 7), tags: ["t"], note: "n", collections: ["C"], favorite: true }],
    });
  });

  it("explains what's wrong with a file it can't use", async () => {
    await expect(readImportFile(file("empty.csv", ""), NOW)).rejects.toThrow(ImportError);
    await expect(readImportFile(file("other.json", '{"hello":1}'), NOW)).rejects.toThrow(/isn't one this app knows/);
    await expect(readImportFile(file("bad.json", "{nope"), NOW)).rejects.toThrow(/isn't valid JSON/);
    const zipWithoutSaved = zipSync({ "media/photo.jpg": new Uint8Array(10) });
    await expect(readImportFile(file("export.zip", zipWithoutSaved), NOW)).rejects.toThrow(/no saved posts in that ZIP/);
  });
});

// ---------- the plan ----------

describe("planImport", () => {
  const parsedInstagram = parseInstagramFiles(
    new Map([
      ["saved_posts.json", JSON.stringify(INSTAGRAM_POSTS)],
      ["saved_collections.json", JSON.stringify(INSTAGRAM_COLLECTIONS)],
    ]),
    NOW,
  );

  it("combines a post listed several times, newest first, with every collection it's in", async () => {
    const plan = await planImport(parsedInstagram, []);
    expect(plan.add).toEqual([
      { id: "instagram_C8xYz12AbCd", url: "https://www.instagram.com/reel/C8xYz12AbCd/", savedAt: 1_758_000_000_000, tags: [], collections: ["Trips"] },
      { id: "instagram_CabcDEF1234", url: "https://www.instagram.com/p/CabcDEF1234/", savedAt: 1_757_000_000_000, tags: [], collections: ["Cafés", "Trips"] },
    ]);
    expect(plan).toMatchObject({ type: "instagram", already: 0, repeated: 3, invalid: 2, update: [], missing: [], collections: ["Trips", "Cafés"] });
  });

  it("leaves saves that exist alone, except for collections and tags the file adds", async () => {
    const library = [
      save({ id: "instagram_C8xYz12AbCd", platform: "instagram", collectionIds: ["c1"], tags: ["travel"] }),
      save({ id: "instagram_CabcDEF1234", platform: "instagram", status: "trashed" }),
    ];
    const plan = await planImport(parsedInstagram, library, new Map([["c1", "trips"]]));
    // The reel is already in "Trips" (whatever the capitals); the trashed post stays in the Trash.
    expect(plan).toMatchObject({ add: [], update: [], already: 2 });

    const plan2 = await planImport(parsedInstagram, [save({ id: "instagram_C8xYz12AbCd", platform: "instagram" })]);
    expect(plan2.update).toEqual([{ id: "instagram_C8xYz12AbCd", tags: [], collections: ["Trips"] }]);
    expect(plan2.add.map((p) => p.id)).toEqual(["instagram_CabcDEF1234"]);
  });

  it("a repeated Instagram import finds the posts that were unsaved on Instagram since", async () => {
    const library = [
      save({ id: "instagram_C8xYz12AbCd", platform: "instagram", source: "import-instagram" }),
      save({ id: "instagram_UnsavedNow1", platform: "instagram", source: "import-instagram" }),
      // Never touched: saved another way, in the Trash already, or from another platform.
      save({ id: "instagram_SharedOnce1", platform: "instagram", source: "share-android" }),
      save({ id: "instagram_TrashedOne1", platform: "instagram", source: "import-instagram", status: "trashed" }),
      save({ id: "youtube_dQw4w9WgXcQ", platform: "youtube", source: "import-instagram" }),
    ];
    const plan = await planImport(parsedInstagram, library);
    expect(plan.missing.map((s) => s.id)).toEqual(["instagram_UnsavedNow1"]);
    // Other kinds of file never look for missing posts, and neither does an empty Instagram file.
    expect((await planImport(parseBookmarks(BOOKMARKS, NOW), library)).missing).toEqual([]);
    expect((await planImport({ type: "instagram", items: [], skipped: 0 }, library)).missing).toEqual([]);
  });

  it("keeps a file's title only for ordinary web pages, normalises tags, and counts what it can't use", async () => {
    const plan = await planImport(parseBookmarks(BOOKMARKS, NOW), []);
    expect(plan.add).toEqual([
      { id: expect.stringMatching(/^url_[0-9a-f]{24}$/), url: "https://example.com/pasta?x=1&y=2", savedAt: 1_700_000_300_000, tags: ["dinner", "quick"], collections: ["Recipes"], title: "Pasta" },
      { id: "youtube_dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", savedAt: 1_700_000_100_000, tags: [], collections: [] },
      { id: "x_20", url: "https://x.com/jack/status/20", tags: [], collections: [] },
    ]);
    expect(plan.invalid).toBe(2);
    const junk = await planImport({ type: "csv", items: [{ url: "http://localhost/x" }, { url: "https://example.com/ok" }], skipped: 3 }, []);
    expect(junk.invalid).toBe(4);
    expect(junk.add).toHaveLength(1);
  });

  it("creates at most 30 new collections per import", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ url: `https://example.com/${i}`, collections: [`Folder ${i}`] }));
    const plan = await planImport({ type: "csv", items, skipped: 0 }, []);
    expect(plan.collections).toHaveLength(MAX_NEW_COLLECTIONS);
    expect(plan.add.filter((p) => p.collections.length > 0)).toHaveLength(MAX_NEW_COLLECTIONS);
    expect(plan.add).toHaveLength(40);
  });
});

describe("the daily limit", () => {
  it("counts by the day in Los Angeles, where the database's quotas reset", () => {
    // 06:30 UTC is still the evening before in Los Angeles.
    expect(pacificDay(Date.UTC(2026, 8, 30, 6, 30))).toBe("2026-09-29");
    expect(pacificDay(Date.UTC(2026, 8, 30, 12))).toBe("2026-09-30");
  });

  it("lets an import write up to the cap each day", () => {
    let record = countWrites(null, 300, NOW);
    expect(leftToday(record, 500, NOW)).toBe(200);
    record = countWrites(record, 200, NOW);
    expect(leftToday(record, 500, NOW)).toBe(0);
    // The next day starts from zero; a lowered cap never goes negative.
    expect(leftToday(record, 500, NOW + 24 * 3600_000)).toBe(500);
    expect(leftToday(record, 100, NOW)).toBe(0);
    expect(countWrites(record, 5, NOW + 24 * 3600_000)).toEqual({ day: "2026-10-01", count: 5 });
  });
});

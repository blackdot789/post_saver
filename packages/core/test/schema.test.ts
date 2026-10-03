import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CATEGORIES,
  LIMITS,
  PLATFORMS,
  SAVE_PLATFORMS,
  SCHEMA_VERSION,
  cleanCategoryName,
  cleanText,
  isCategoryId,
  moveToTop,
  newCategory,
  newSave,
  newText,
  newUserDoc,
  normalizeTag,
  normalizeTags,
  parse,
  planSave,
  restoreFromTrash,
  tombstone,
} from "../src/index.ts";

describe("normalizeTag", () => {
  it.each([
    ["  Road   Trip ", "road trip"],
    ["#Food", "food"],
    ["##travel", "travel"],
    ["c#", "c#"],
    ["a,b", "a b"],
    ["line\nbreak", "line break"],
    ["ÉTÉ", "été"],
    ["🍕 Pizza", "🍕 pizza"],
    ["   ", null],
    ["#", null],
  ])("%j → %j", (raw, expected) => {
    expect(normalizeTag(raw)).toBe(expected);
  });

  it("cuts at 40 UTF-16 units without splitting an emoji", () => {
    expect(normalizeTag("x".repeat(50))).toBe("x".repeat(LIMITS.tagLength));
    const tag = normalizeTag(`${"x".repeat(39)}😀`);
    expect(tag).toBe("x".repeat(39));
  });
});

describe("normalizeTags", () => {
  it("normalises, removes duplicates and caps the list", () => {
    expect(normalizeTags(["Food", "food", " #FOOD ", "", "travel"])).toEqual(["food", "travel"]);
    expect(normalizeTags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(LIMITS.tags);
  });
});

describe("newSave", () => {
  const NOW = "server-time";

  it("builds the full document the rules expect", () => {
    const link = parse("https://www.instagram.com/natgeo/reel/C8xYz12AbCd/?igsh=abc");
    if (!link) throw new Error("parse failed");
    expect(newSave(link, { source: "share-android", now: NOW })).toEqual({
      url: "https://www.instagram.com/reel/C8xYz12AbCd/",
      originalUrl: "https://www.instagram.com/natgeo/reel/C8xYz12AbCd/?igsh=abc",
      platform: "instagram",
      kind: "reel",
      platformId: "C8xYz12AbCd",
      author: "natgeo",
      tags: [],
      collectionIds: [],
      favorite: false,
      status: "active",
      deleted: false,
      source: "share-android",
      savedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      embedStatus: "unknown",
      needsResolve: false,
      // Instagram offers no title or author without a login, so there's nothing to wait for.
      needsMeta: false,
      schemaVersion: SCHEMA_VERSION,
    });
  });

  it("waits for metadata only on platforms that offer some", () => {
    const needsMeta = (url: string) => {
      const link = parse(url);
      if (!link) throw new Error("parse failed");
      return newSave(link, { source: "web", now: NOW }).needsMeta;
    };
    expect(needsMeta("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(needsMeta("https://x.com/jack/status/20")).toBe(true);
    expect(needsMeta("https://example.com/article")).toBe(true);
    expect(needsMeta("https://www.threads.com/@zuck/post/CuP48CiS5sx")).toBe(false);
    expect(needsMeta("https://www.linkedin.com/feed/update/urn:li:activity:7168922878233489408/")).toBe(false);
  });

  it("keeps an import date, and normalises tags and note", () => {
    const link = parse("https://vm.tiktok.com/ZMhvqjXXX/");
    if (!link) throw new Error("parse failed");
    const doc = newSave(link, { source: "import-dewey", now: NOW, savedAt: "2024-01-01", tags: ["Funny"], note: "  hi  " });
    expect(doc).toMatchObject({ savedAt: "2024-01-01", createdAt: NOW, tags: ["funny"], note: "hi", needsResolve: true, platformId: null });
    expect(doc).not.toHaveProperty("author");
  });

  it("leaves out empty optional fields (Firestore can't store undefined)", () => {
    const link = parse("https://example.com/a");
    if (!link) throw new Error("parse failed");
    const doc = newSave(link, { source: "web", now: NOW, note: "   " });
    expect(Object.values(doc)).not.toContain(undefined);
    expect(doc).not.toHaveProperty("note");
  });
});

describe("tombstone", () => {
  it("keeps only what other devices need to learn about the delete", () => {
    expect(tombstone(1)).toEqual({ deleted: true, updatedAt: 1, schemaVersion: SCHEMA_VERSION });
  });
});

describe("planSave", () => {
  it.each([
    ["nothing stored", undefined, "create"],
    ["known to be missing", null, "create"],
    ["a tombstone", { deleted: true, updatedAt: 1 }, "create"],
    ["a live save", { deleted: false, status: "active" }, "exists"],
    ["a trashed save", { deleted: false, status: "trashed" }, "restore"],
  ])("%s → %s", (_label, stored, plan) => {
    expect(planSave(stored)).toBe(plan);
  });
});

describe("edits", () => {
  it("move to top bumps savedAt and updatedAt only", () => {
    expect(moveToTop("now")).toEqual({ savedAt: "now", updatedAt: "now" });
  });
  it("restoring from trash removes trashedAt", () => {
    expect(restoreFromTrash("now", "DELETE")).toEqual({ status: "active", trashedAt: "DELETE", updatedAt: "now" });
  });
});

describe("newUserDoc", () => {
  it("starts with empty settings and leaves out a missing name", () => {
    expect(newUserDoc({ email: "a@example.com", displayName: null, now: 1 })).toEqual({
      email: "a@example.com",
      createdAt: 1,
      updatedAt: 1,
      settings: {},
      schemaVersion: SCHEMA_VERSION,
    });
  });
  it("trims and caps the display name", () => {
    const doc = newUserDoc({ email: "a@example.com", displayName: ` ${"n".repeat(150)} `, now: 1 });
    expect(doc.displayName).toBe("n".repeat(LIMITS.displayName));
  });
});

describe("cleanText", () => {
  it.each([
    ["hello", "hello"],
    ["  indented first line\n  and the second", "  indented first line\n  and the second"],
    ["\n \n\nblank lines before", "blank lines before"],
    ["space after  \n\n \t", "space after"],
    ["windows\r\nline\rbreaks", "windows\nline\nbreaks"],
    ["tabs\tstay", "tabs\tstay"],
    ["nul\u0000 and bell\u0007 go", "nul and bell go"],
    ["half a pair \uD83D is dropped, 😀 stays", "half a pair  is dropped, 😀 stays"],
    ["   \n\t ", null],
    ["", null],
  ])("%j → %j", (raw, expected) => {
    expect(cleanText(raw)).toBe(expected);
  });

  it("cuts at the limit without splitting an emoji, and is stable", () => {
    expect(cleanText("x".repeat(LIMITS.text + 50))).toBe("x".repeat(LIMITS.text));
    const cut = cleanText(`${"x".repeat(LIMITS.text - 1)}😀`);
    expect(cut).toBe("x".repeat(LIMITS.text - 1));
    const messy = `\n\n  ${"word \r\n".repeat(3000)}`;
    const once = cleanText(messy);
    expect(once).not.toBeNull();
    expect(cleanText(once ?? "")).toBe(once);
  });
});

describe("newText", () => {
  it("builds the full document the rules expect", () => {
    expect(newText("Gate code 4821#", { source: "paste", now: "server-time", tags: ["Home"], note: " Front gate " })).toEqual({
      text: "Gate code 4821#",
      platform: "text",
      note: "Front gate",
      tags: ["home"],
      collectionIds: [],
      favorite: false,
      status: "active",
      deleted: false,
      source: "paste",
      savedAt: "server-time",
      createdAt: "server-time",
      updatedAt: "server-time",
      schemaVersion: SCHEMA_VERSION,
    });
  });

  it("is filed beside the platforms, never as one of them", () => {
    expect(SAVE_PLATFORMS).toEqual([...PLATFORMS, "text"]);
    expect(PLATFORMS).not.toContain("text");
  });
});

describe("categories", () => {
  it("the ready-made ones have ids the rules accept, each different", () => {
    expect(BUILT_IN_CATEGORIES.map((c) => c.id)).toEqual(["note", "quote", "command", "article", "blog"]);
    for (const c of BUILT_IN_CATEGORIES) {
      expect(isCategoryId(c.id)).toBe(true);
      expect(c.name).not.toBe("");
      expect(c.symbol.length).toBeGreaterThan(0);
      expect(c.symbol.length).toBeLessThanOrEqual(LIMITS.emoji);
    }
  });

  it.each([
    ["", false],
    ["note", true],
    ["Qx7Lm2Vt9KpRw4Zs8NbY", true],
    ["my notes", false],
    ["a/b", false],
    ["x".repeat(40), true],
    ["x".repeat(41), false],
    [7, false],
    [undefined, false],
  ])("isCategoryId(%j) is %s", (value, ok) => expect(isCategoryId(value)).toBe(ok));

  it("a new save or text carries its category, and leaves out one that isn't an id", () => {
    const link = parse("https://example.com/how-to-bake");
    if (!link) throw new Error("no link");
    expect(newSave(link, { source: "web", now: 1, category: "article" }).category).toBe("article");
    expect(newSave(link, { source: "web", now: 1 })).not.toHaveProperty("category");
    expect(newSave(link, { source: "web", now: 1, category: "not an id" })).not.toHaveProperty("category");
    expect(newText("ls -la", { source: "paste", now: 1, category: "command" }).category).toBe("command");
    expect(newText("ls -la", { source: "paste", now: 1, category: "" })).not.toHaveProperty("category");
  });

  it("cleans a name: single spaces, trimmed, cut by whole characters", () => {
    expect(cleanCategoryName("  My \n  recipes ")).toBe("My recipes");
    expect(cleanCategoryName("😀".repeat(50))).toBe("😀".repeat(LIMITS.categoryName / 2));
    expect(cleanCategoryName("   ")).toBe("");
  });

  it("newCategory builds the document the rules expect", () => {
    expect(newCategory({ name: " Recipes ", symbol: "🍳", order: 2, now: "server-time" })).toEqual({
      name: "Recipes",
      symbol: "🍳",
      order: 2,
      createdAt: "server-time",
      updatedAt: "server-time",
      deleted: false,
    });
  });
});

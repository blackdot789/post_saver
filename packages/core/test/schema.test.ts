import { describe, expect, it } from "vitest";
import {
  LIMITS,
  SCHEMA_VERSION,
  moveToTop,
  newSave,
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

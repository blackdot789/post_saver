import { describe, expect, it } from "vitest";
import type { LibrarySave } from "../sync/library.ts";
import { applyQuery, parseQuery, platformsInUse, queryToSearch, tagCounts } from "./query.ts";

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
    needsMeta: true,
    schemaVersion: 1,
    pending: false,
    ...over,
  };
}

const d = (day: number) => new Date(2026, 8, day);
const saves = [
  save({ id: "a", platform: "instagram", savedAt: d(1), updatedAt: d(9), tags: ["food"], favorite: true }),
  save({ id: "b", platform: "youtube", savedAt: d(2), updatedAt: d(2), tags: ["food", "travel"], collectionIds: ["c1"] }),
  save({ id: "c", platform: "instagram", savedAt: d(3), updatedAt: d(3), embedStatus: "unavailable" }),
  save({ id: "t", platform: "x", savedAt: d(4), updatedAt: d(4), status: "trashed", tags: ["food"] }),
];
const ids = (list: LibrarySave[]) => list.map((s) => s.id);

describe("parseQuery / queryToSearch", () => {
  it("defaults to everything, newest first, with an empty query string", () => {
    expect(parseQuery("")).toEqual({ view: "all", q: "", sort: "newest" });
    expect(queryToSearch(parseQuery(""))).toBe("");
  });
  it("round-trips a full query and ignores junk", () => {
    const q = parseQuery("?view=favorites&collection=c1&tag=Food&platform=instagram&q=cake&sort=oldest");
    expect(q).toEqual({ view: "favorites", collection: "c1", tag: "food", platform: "instagram", q: "cake", sort: "oldest" });
    expect(parseQuery(queryToSearch(q))).toEqual(q);
    expect(parseQuery("?view=secret&platform=myspace&sort=random&collection=../x")).toEqual({ view: "all", q: "", sort: "newest" });
  });
});

describe("applyQuery", () => {
  it("shows live saves newest first, and the Trash separately", () => {
    expect(ids(applyQuery(saves, parseQuery("")))).toEqual(["c", "b", "a"]);
    expect(ids(applyQuery(saves, parseQuery("?view=trash")))).toEqual(["t"]);
  });
  it("filters by favorites, unavailable, collection, tag and platform", () => {
    expect(ids(applyQuery(saves, parseQuery("?view=favorites")))).toEqual(["a"]);
    expect(ids(applyQuery(saves, parseQuery("?view=unavailable")))).toEqual(["c"]);
    expect(ids(applyQuery(saves, parseQuery("?collection=c1")))).toEqual(["b"]);
    expect(ids(applyQuery(saves, parseQuery("?tag=food")))).toEqual(["b", "a"]);
    expect(ids(applyQuery(saves, parseQuery("?platform=instagram&tag=food")))).toEqual(["a"]);
  });
  it("sorts oldest and recently updated", () => {
    expect(ids(applyQuery(saves, parseQuery("?sort=oldest")))).toEqual(["a", "b", "c"]);
    expect(ids(applyQuery(saves, parseQuery("?sort=updated")))).toEqual(["a", "c", "b"]);
  });
  it("keeps only search matches when there's a search", () => {
    expect(ids(applyQuery(saves, parseQuery("?q=x"), new Set(["a", "t"])))).toEqual(["a"]);
  });
});

describe("tagCounts and platformsInUse", () => {
  it("count live saves only, most used first", () => {
    expect(tagCounts(saves)).toEqual([
      { tag: "food", count: 2 },
      { tag: "travel", count: 1 },
    ]);
    expect(platformsInUse(saves)).toEqual(["instagram", "youtube"]);
  });
});

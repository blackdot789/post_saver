import { describe, expect, it } from "vitest";
import { toLibrarySave, type LibrarySave, type LinkSave } from "../sync/library.ts";
import { applyQuery, parseQuery, platformsInUse, queryToSearch, tagCounts } from "./query.ts";

function save(over: Partial<LinkSave> & { id: string }): LinkSave {
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

describe("saved texts in the library", () => {
  const text = toLibrarySave("text_0123456789abcdef01234567", { text: "Gate code 4821#", platform: "text", tags: ["home"], collectionIds: [], favorite: false, status: "active", source: "paste", schemaVersion: 1 }, false);
  const all = [...saves, { ...text, savedAt: d(5), updatedAt: d(5) }];

  it("are read as texts: no link, nothing to look up", () => {
    expect(text).toMatchObject({ platform: "text", text: "Gate code 4821#", url: "", needsResolve: false, needsMeta: false, tags: ["home"] });
  });
  it("a document that says it's a text but has none is read as an (empty) link, not as a text", () => {
    expect(toLibrarySave("x", { platform: "text" }, false).text).toBeUndefined();
  });
  it("sit among the saves, with a filter of their own", () => {
    expect(ids(applyQuery(all, parseQuery("")))).toEqual([text.id, "c", "b", "a"]);
    expect(ids(applyQuery(all, parseQuery("?platform=text")))).toEqual([text.id]);
    expect(parseQuery("?platform=text").platform).toBe("text");
    expect(platformsInUse(all)).toEqual(["instagram", "youtube", "text"]);
    expect(tagCounts(all)).toContainEqual({ tag: "home", count: 1 });
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

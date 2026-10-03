import { describe, expect, it } from "vitest";
import { toLibrarySave, type LibrarySave, type LinkSave } from "../sync/library.ts";
import { BUILT_IN_INDEX, indexCategories, type Category } from "../data/categories.ts";
import { applyQuery, categoriesInUse, parseQuery, platformsInUse, queryToSearch, tagCounts } from "./query.ts";

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
    expect(ids(applyQuery(saves, parseQuery(""), BUILT_IN_INDEX))).toEqual(["c", "b", "a"]);
    expect(ids(applyQuery(saves, parseQuery("?view=trash"), BUILT_IN_INDEX))).toEqual(["t"]);
  });
  it("filters by favorites, unavailable, collection, tag and platform", () => {
    expect(ids(applyQuery(saves, parseQuery("?view=favorites"), BUILT_IN_INDEX))).toEqual(["a"]);
    expect(ids(applyQuery(saves, parseQuery("?view=unavailable"), BUILT_IN_INDEX))).toEqual(["c"]);
    expect(ids(applyQuery(saves, parseQuery("?collection=c1"), BUILT_IN_INDEX))).toEqual(["b"]);
    expect(ids(applyQuery(saves, parseQuery("?tag=food"), BUILT_IN_INDEX))).toEqual(["b", "a"]);
    expect(ids(applyQuery(saves, parseQuery("?platform=instagram&tag=food"), BUILT_IN_INDEX))).toEqual(["a"]);
  });
  it("sorts oldest and recently updated", () => {
    expect(ids(applyQuery(saves, parseQuery("?sort=oldest"), BUILT_IN_INDEX))).toEqual(["a", "b", "c"]);
    expect(ids(applyQuery(saves, parseQuery("?sort=updated"), BUILT_IN_INDEX))).toEqual(["a", "c", "b"]);
  });
  it("keeps only search matches when there's a search", () => {
    expect(ids(applyQuery(saves, parseQuery("?q=x"), BUILT_IN_INDEX, new Set(["a", "t"])))).toEqual(["a"]);
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
    expect(ids(applyQuery(all, parseQuery(""), BUILT_IN_INDEX))).toEqual([text.id, "c", "b", "a"]);
    expect(ids(applyQuery(all, parseQuery("?platform=text"), BUILT_IN_INDEX))).toEqual([text.id]);
    expect(parseQuery("?platform=text").platform).toBe("text");
    expect(platformsInUse(all, BUILT_IN_INDEX)).toEqual(["instagram", "youtube", "text"]);
    expect(tagCounts(all)).toContainEqual({ tag: "home", count: 1 });
  });
});

describe("tagCounts and platformsInUse", () => {
  it("count live saves only, most used first", () => {
    expect(tagCounts(saves)).toEqual([
      { tag: "food", count: 2 },
      { tag: "travel", count: 1 },
    ]);
    expect(platformsInUse(saves, BUILT_IN_INDEX)).toEqual(["instagram", "youtube"]);
  });
});

describe("categories as tabs", () => {
  const recipes: Category = { id: "Qx7Lm2Vt9KpRw4Zs8NbY", name: "Recipes", symbol: "🍳", own: true };
  const empty: Category = { id: "Empty0000000000000000", name: "Ideas", symbol: "💡", own: true };
  const categories = indexCategories([recipes, empty]);
  const text = (id: string, day: number, category?: string): LibrarySave => ({
    ...toLibrarySave(id, { text: id, platform: "text", tags: [], collectionIds: [], status: "active", source: "paste", ...(category ? { category } : {}) }, false),
    savedAt: d(day),
  });
  const all: LibrarySave[] = [
    text("plain", 1),
    text("ls", 2, "command"),
    text("carbonara", 3, recipes.id),
    text("orphan", 4, "Deleted0000000000000"),
    save({ id: "page", savedAt: d(5) }),
    save({ id: "post", savedAt: d(6), category: "article" }),
    save({ id: "reel", platform: "instagram", savedAt: d(7), category: recipes.id }),
    save({ id: "binned", savedAt: d(8), status: "trashed", category: "quote" }),
  ];

  it("a text or page with a category sits under its category, not under Text or Web", () => {
    expect(ids(applyQuery(all, parseQuery("?platform=text"), categories))).toEqual(["orphan", "plain"]);
    expect(ids(applyQuery(all, parseQuery("?platform=web"), categories))).toEqual(["page"]);
    expect(ids(applyQuery(all, parseQuery("?category=command"), categories))).toEqual(["ls"]);
    expect(ids(applyQuery(all, parseQuery("?category=article"), categories))).toEqual(["post"]);
  });
  it("a post from an app stays under its app's tab, and shows under its category too", () => {
    expect(ids(applyQuery(all, parseQuery("?platform=instagram"), categories))).toEqual(["reel"]);
    expect(ids(applyQuery(all, parseQuery(`?category=${recipes.id}`), categories))).toEqual(["reel", "carbonara"]);
  });
  it("everything is under All, whatever its category", () => {
    expect(applyQuery(all, parseQuery(""), categories)).toHaveLength(7);
  });
  it("a save whose category was deleted is filed as if it had none", () => {
    expect(ids(applyQuery(all, parseQuery("?category=Deleted0000000000000"), categories))).toEqual([]);
    // Before the owner's categories have been read, theirs count as unknown.
    expect(ids(applyQuery(all, parseQuery("?platform=text"), BUILT_IN_INDEX))).toEqual(["orphan", "carbonara", "plain"]);
  });
  it("tabs: platforms with something left under them, ready-made categories in use, the owner's always", () => {
    expect(platformsInUse(all, categories)).toEqual(["instagram", "web", "text"]);
    expect(categoriesInUse(all, categories).map((c) => c.name)).toEqual(["Command", "Article", "Recipes", "Ideas"]);
    const filed = all.filter((s) => s.id !== "plain" && s.id !== "orphan" && s.id !== "page");
    expect(platformsInUse(filed, categories)).toEqual(["instagram"]);
  });
  it("the address bar holds one tab: a platform or a category", () => {
    expect(parseQuery("?category=command")).toEqual({ view: "all", category: "command", q: "", sort: "newest" });
    expect(queryToSearch(parseQuery("?category=command"))).toBe("?category=command");
    expect(parseQuery("?platform=text&category=command")).toEqual({ view: "all", platform: "text", q: "", sort: "newest" });
    expect(parseQuery("?category=../x")).toEqual({ view: "all", q: "", sort: "newest" });
  });
});

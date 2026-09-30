import { PLATFORMS, type Platform } from "@postsaver/core";
import type { LibrarySave } from "../sync/library.ts";

// What the library shows, kept in /app/'s query string (CLAUDE.md §4.3: state inside /app/
// goes in query params), so a view can be reloaded, shared between tabs, and navigated back to.

export type View = "all" | "favorites" | "unavailable" | "trash";
export type Sort = "newest" | "oldest" | "updated";
export type Layout = "grid" | "list";

export interface LibraryQuery {
  view: View;
  collection?: string;
  tag?: string;
  platform?: Platform;
  q: string;
  sort: Sort;
}

export const DEFAULT_QUERY: LibraryQuery = { view: "all", q: "", sort: "newest" };

const VIEWS: readonly View[] = ["all", "favorites", "unavailable", "trash"];
const SORTS: readonly Sort[] = ["newest", "oldest", "updated"];

export function parseQuery(search: string): LibraryQuery {
  const p = new URLSearchParams(search);
  const view = p.get("view") as View | null;
  const sort = p.get("sort") as Sort | null;
  const platform = p.get("platform") as Platform | null;
  const collection = p.get("collection")?.trim();
  const tag = p.get("tag")?.trim().toLowerCase();
  return {
    view: view && VIEWS.includes(view) ? view : "all",
    ...(collection && /^[A-Za-z0-9]{1,40}$/.test(collection) ? { collection } : {}),
    ...(tag ? { tag } : {}),
    ...(platform && PLATFORMS.includes(platform) ? { platform } : {}),
    q: p.get("q")?.trim() ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
  };
}

/** The query string for a view; defaults are left out, so the plain /app/ is "all, newest". */
export function queryToSearch(query: LibraryQuery): string {
  const p = new URLSearchParams();
  if (query.view !== "all") p.set("view", query.view);
  if (query.collection) p.set("collection", query.collection);
  if (query.tag) p.set("tag", query.tag);
  if (query.platform) p.set("platform", query.platform);
  if (query.q) p.set("q", query.q);
  if (query.sort !== "newest") p.set("sort", query.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const time = (d: Date | undefined) => d?.getTime() ?? 0;

const SORTERS: Record<Sort, (a: LibrarySave, b: LibrarySave) => number> = {
  newest: (a, b) => time(b.savedAt) - time(a.savedAt),
  oldest: (a, b) => time(a.savedAt) - time(b.savedAt),
  updated: (a, b) => time(b.updatedAt) - time(a.updatedAt),
};

/**
 * The saves a query shows, in order. `matches` is the search result (ids) when there's a
 * search term; the Trash view shows trashed saves, every other view only live ones.
 */
export function applyQuery(saves: readonly LibrarySave[], query: LibraryQuery, matches?: ReadonlySet<string>): LibrarySave[] {
  const out = saves.filter((s) => {
    if (query.view === "trash") return s.status === "trashed";
    if (s.status !== "active") return false;
    if (query.view === "favorites" && !s.favorite) return false;
    if (query.view === "unavailable" && s.embedStatus !== "unavailable") return false;
    if (query.collection && !s.collectionIds.includes(query.collection)) return false;
    if (query.tag && !s.tags.includes(query.tag)) return false;
    if (query.platform && s.platform !== query.platform) return false;
    if (matches && !matches.has(s.id)) return false;
    return true;
  });
  return out.sort(SORTERS[query.sort]);
}

/** Tags in use on live saves, most used first. */
export function tagCounts(saves: readonly LibrarySave[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of saves) {
    if (s.status !== "active") continue;
    for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Platforms with at least one live save, in the config's order. */
export function platformsInUse(saves: readonly LibrarySave[]): Platform[] {
  const used = new Set(saves.filter((s) => s.status === "active").map((s) => s.platform));
  return PLATFORMS.filter((p) => used.has(p));
}

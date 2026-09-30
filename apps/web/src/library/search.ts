import MiniSearch from "minisearch";
import { useMemo } from "react";
import { PLATFORM_NAMES } from "../lib/platforms.ts";
import type { LibrarySave } from "../sync/library.ts";

// Search happens in memory, over the device's copy of the library (CLAUDE.md §6.5): title,
// author, tags, note, platform and the link. Prefix and fuzzy matching, so "recipe" finds
// "recipes" and "instagram" finds Instagram posts.

interface Doc {
  id: string;
  title: string;
  author: string;
  tags: string;
  note: string;
  platform: string;
  url: string;
}

function toDoc(s: LibrarySave): Doc {
  return {
    id: s.id,
    title: s.title ?? "",
    author: s.author ?? "",
    tags: s.tags.join(" "),
    note: s.note ?? "",
    platform: PLATFORM_NAMES[s.platform],
    url: s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/[/?&=._-]+/g, " "),
  };
}

/** Returns a function that gives the ids matching a search, or undefined for an empty search. */
export function useSearch(saves: readonly LibrarySave[]): (q: string) => Set<string> | undefined {
  const index = useMemo(() => {
    const mini = new MiniSearch<Doc>({
      fields: ["title", "author", "tags", "note", "platform", "url"],
      storeFields: [],
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2, tags: 2, author: 1.5 } },
    });
    mini.addAll(saves.map(toDoc));
    return mini;
  }, [saves]);
  return (q: string) => {
    const term = q.trim();
    if (!term) return undefined;
    return new Set(index.search(term).map((r) => String(r.id)));
  };
}

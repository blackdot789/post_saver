import { useCallback, useEffect, useState } from "react";
import { parseQuery, queryToSearch, type LibraryQuery } from "./query.ts";

/** The library query, read from and written to /app/'s query string (replace, not push). */
export function useQuery(): [LibraryQuery, (patch: Partial<LibraryQuery>) => void] {
  const [query, setQuery] = useState(() => parseQuery(location.search));

  useEffect(() => {
    const onPop = () => setQuery(parseQuery(location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<LibraryQuery>) => {
    setQuery((prev) => {
      // A filter change clears the ones that don't combine with it.
      const next: LibraryQuery = { ...prev, ...patch };
      if ("view" in patch) {
        delete next.collection;
        delete next.tag;
      }
      if ("collection" in patch && patch.collection) {
        next.view = "all";
        delete next.tag;
      }
      if ("tag" in patch && patch.tag) {
        next.view = "all";
        delete next.collection;
      }
      // One tab at a time: a platform or a category.
      if (patch.platform) delete next.category;
      if (patch.category) delete next.platform;
      history.replaceState(null, "", `${location.pathname}${queryToSearch(next)}`);
      return next;
    });
  }, []);

  return [query, update];
}

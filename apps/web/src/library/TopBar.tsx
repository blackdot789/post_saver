import type { RefObject } from "react";
import type { Platform } from "@postsaver/core";
import { PLATFORM_NAMES } from "../lib/platforms.ts";
import { Button } from "../ui/Button.tsx";
import { cx } from "../ui/cx.ts";
import type { Layout, LibraryQuery, Sort } from "./query.ts";

interface TopBarProps {
  query: LibraryQuery;
  onQuery: (patch: Partial<LibraryQuery>) => void;
  platforms: Platform[];
  layout: Layout;
  onLayout: (layout: Layout) => void;
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  shown: number;
}

const SORT_LABELS: Record<Sort, string> = { newest: "Newest saved", oldest: "Oldest saved", updated: "Recently updated" };

/** Search, platform chips, sort and layout. */
export function TopBar({ query, onQuery, platforms, layout, onLayout, selecting, onSelecting, searchRef, shown }: TopBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search your saves</span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search titles, tags, notes…  ( / )"
            value={query.q}
            onChange={(e) => onQuery({ q: e.target.value })}
            className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base placeholder:text-slate-400 focus:border-brand-from focus:outline-3 focus:outline-brand-from/25 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-slate-500"
          />
        </label>
        <label className="text-sm">
          <span className="sr-only">Sort</span>
          <select
            value={query.sort}
            onChange={(e) => onQuery({ sort: e.target.value as Sort })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-xl border border-slate-300 text-sm dark:border-white/15">
          {(["grid", "list"] as Layout[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layout === l}
              onClick={() => onLayout(l)}
              className={cx("px-3 py-2.5 capitalize", layout === l ? "bg-brand-from/10 font-semibold dark:bg-brand-from/25" : "hover:bg-slate-100 dark:hover:bg-white/10")}
            >
              {l}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" aria-pressed={selecting} onClick={() => onSelecting(!selecting)} className="py-2.5">
          {selecting ? "Done" : "Select"}
        </Button>
      </div>
      {platforms.length > 1 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Platforms">
          <li>
            <button
              type="button"
              aria-pressed={!query.platform}
              onClick={() => onQuery({ platform: undefined })}
              className={cx("rounded-full px-3 py-1 text-sm", !query.platform ? "bg-brand-to text-white" : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15")}
            >
              All
            </button>
          </li>
          {platforms.map((p) => (
            <li key={p}>
              <button
                type="button"
                aria-pressed={query.platform === p}
                onClick={() => onQuery({ platform: query.platform === p ? undefined : p })}
                className={cx("rounded-full px-3 py-1 text-sm", query.platform === p ? "bg-brand-to text-white" : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15")}
              >
                {PLATFORM_NAMES[p]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400" role="status">
        {shown === 1 ? "1 save" : `${shown} saves`}
        {query.q && ` matching “${query.q}”`}
      </p>
    </div>
  );
}

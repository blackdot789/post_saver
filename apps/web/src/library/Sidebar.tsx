import type { Collection } from "../data/collections.ts";
import { cx } from "../ui/cx.ts";
import type { LibraryQuery, View } from "./query.ts";

interface SidebarProps {
  query: LibraryQuery;
  onQuery: (patch: Partial<LibraryQuery>) => void;
  counts: { all: number; favorites: number; unavailable: number; trash: number };
  collections: Collection[];
  tags: Array<{ tag: string; count: number }>;
  onNewCollection: () => void;
  onManageCollection: (collection: Collection) => void;
}

const VIEWS: Array<{ view: View; label: string }> = [
  { view: "all", label: "All saves" },
  { view: "favorites", label: "Favorites" },
  { view: "unavailable", label: "Unavailable" },
  { view: "trash", label: "Trash" },
];

const MAX_TAGS = 12;

function Item({ active, label, count, onClick, onMore }: { active: boolean; label: string; count?: number; onClick: () => void; onMore?: () => void }) {
  return (
    <li className="flex items-center">
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        className={cx(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
          active ? "bg-brand-from/10 font-semibold text-brand-ink dark:bg-brand-from/20 dark:text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10",
        )}
      >
        <span className="truncate">{label}</span>
        {count !== undefined && <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{count}</span>}
      </button>
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          aria-label={`Rename or delete ${label}`}
          className="ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-ink dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      )}
    </li>
  );
}

/** Views, collections and tags. A column on wide screens, a sheet on phones. */
export function Sidebar({ query, onQuery, counts, collections, tags, onNewCollection, onManageCollection }: SidebarProps) {
  const inView = (view: View) => query.view === view && !query.collection && !query.tag;
  return (
    <nav aria-label="Library" className="space-y-6 text-sm">
      <ul className="space-y-0.5">
        {VIEWS.map(({ view, label }) => (
          <Item key={view} active={inView(view)} label={label} count={counts[view]} onClick={() => onQuery({ view })} />
        ))}
      </ul>

      <div>
        <div className="mb-1 flex items-center justify-between px-3">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Collections</h2>
          <button type="button" onClick={onNewCollection} className="text-xs font-medium text-blue-600 hover:underline dark:text-sky-400">
            New
          </button>
        </div>
        {collections.length === 0 ? (
          <p className="px-3 text-xs text-slate-500 dark:text-slate-400">Group saves into collections, e.g. Recipes or Trips.</p>
        ) : (
          <ul className="space-y-0.5">
            {collections.map((c) => (
              <Item
                key={c.id}
                active={query.collection === c.id}
                label={c.emoji ? `${c.emoji} ${c.name}` : c.name}
                onClick={() => onQuery({ collection: c.id })}
                onMore={() => onManageCollection(c)}
              />
            ))}
          </ul>
        )}
      </div>

      {tags.length > 0 && (
        <div>
          <h2 className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Tags</h2>
          <ul className="flex flex-wrap gap-1.5 px-3">
            {tags.slice(0, MAX_TAGS).map(({ tag, count }) => (
              <li key={tag}>
                <button
                  type="button"
                  aria-pressed={query.tag === tag}
                  onClick={() => onQuery(query.tag === tag ? { tag: undefined } : { tag })}
                  className={cx(
                    "rounded-full px-2.5 py-1 text-xs",
                    query.tag === tag ? "bg-brand-to text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15",
                  )}
                >
                  {tag} <span className="opacity-70">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

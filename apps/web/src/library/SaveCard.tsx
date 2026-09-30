import type { EmbedTheme, Platform } from "@postsaver/core";
import { Preview } from "../embeds-host/Preview.tsx";
import { PlatformBadge } from "../lib/PlatformBadge.tsx";
import { authorLabel, describeLink, displayHost, formatDay } from "../lib/platforms.ts";
import type { LibrarySave } from "../sync/library.ts";
import { cx } from "../ui/cx.ts";
import { Menu, type MenuItem } from "../ui/Menu.tsx";
import type { Layout } from "./query.ts";

export interface SaveActions {
  favorite: (save: LibrarySave) => void;
  tags: (save: LibrarySave) => void;
  note: (save: LibrarySave) => void;
  collections: (save: LibrarySave) => void;
  copyLink: (save: LibrarySave) => void;
  trash: (save: LibrarySave) => void;
  restore: (save: LibrarySave) => void;
  deleteForever: (save: LibrarySave) => void;
  verdict: (save: LibrarySave, status: "ok" | "unavailable") => void;
}

export interface SaveCardProps {
  save: LibrarySave;
  layout: Layout;
  theme: EmbedTheme;
  previews: "always" | "click";
  disabledPlatforms: readonly Platform[];
  collectionNames: ReadonlyMap<string, string>;
  actions: SaveActions;
  /** Select mode: a checkbox instead of the menu. */
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

function menuItems(save: LibrarySave, a: SaveActions): MenuItem[] {
  if (save.status === "trashed") {
    return [
      { label: "Restore", onSelect: () => a.restore(save) },
      { label: "Delete forever", onSelect: () => a.deleteForever(save), danger: true },
    ];
  }
  return [
    { label: "Open original", onSelect: () => window.open(save.url, "_blank", "noopener,noreferrer") },
    { label: "Copy link", onSelect: () => a.copyLink(save) },
    { label: save.favorite ? "Remove from favorites" : "Add to favorites", onSelect: () => a.favorite(save) },
    { label: "Tags…", onSelect: () => a.tags(save) },
    { label: "Collections…", onSelect: () => a.collections(save) },
    { label: "Note…", onSelect: () => a.note(save) },
    { label: "Move to Trash", onSelect: () => a.trash(save), danger: true },
  ];
}

function Header({ save, actions, selecting, selected, onToggleSelect }: Pick<SaveCardProps, "save" | "actions" | "selecting" | "selected" | "onToggleSelect">) {
  return (
    <div className="flex items-center gap-2">
      {selecting && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(save.id)}
          aria-label={`Select ${describeLink(save)}`}
          className="size-5 accent-brand-to"
        />
      )}
      <PlatformBadge platform={save.platform} />
      {save.author && <span className="truncate text-sm text-slate-500 dark:text-slate-400">{authorLabel(save.platform, save.author)}</span>}
      <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {save.pending ? "Syncing…" : save.savedAt ? formatDay(save.savedAt) : ""}
      </span>
      {!selecting && <Menu label={`Actions for ${describeLink(save)}`} items={menuItems(save, actions)} />}
    </div>
  );
}

function Tags({ save }: { save: LibrarySave }) {
  if (save.tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {save.tags.map((t) => (
        <li key={t} className="rounded-full bg-brand-from/10 px-2 py-0.5 text-xs text-brand-ink dark:bg-brand-from/20 dark:text-slate-100">
          {t}
        </li>
      ))}
    </ul>
  );
}

function CollectionChips({ save, names }: { save: LibrarySave; names: ReadonlyMap<string, string> }) {
  const labels = save.collectionIds.map((id) => names.get(id)).filter((n): n is string => !!n);
  if (labels.length === 0) return null;
  return <p className="truncate text-xs text-slate-500 dark:text-slate-400">In {labels.join(", ")}</p>;
}

/** One save, as a card in the grid (with its preview) or a compact row in the list. */
export function SaveCard(props: SaveCardProps) {
  const { save, layout, theme, previews, disabledPlatforms, collectionNames, actions, selected, selecting } = props;
  const frame = cx(
    "rounded-2xl border bg-white transition dark:bg-white/5",
    selected ? "border-brand-from ring-2 ring-brand-from/30" : "border-slate-200 dark:border-white/10",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-from",
  );
  const favoriteButton = (
    <button
      type="button"
      onClick={() => actions.favorite(save)}
      aria-pressed={save.favorite}
      aria-label={save.favorite ? "Remove from favorites" : "Add to favorites"}
      className={cx("grid size-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10", save.favorite ? "text-amber-500" : "text-slate-400")}
    >
      <StarIcon filled={save.favorite} className="size-5" />
    </button>
  );

  if (layout === "list") {
    return (
      <li data-save-id={save.id} tabIndex={0} className={cx(frame, "flex items-start gap-3 px-4 py-3")}>
        <div className="min-w-0 flex-1">
          <Header {...props} />
          <a href={save.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-sm font-medium text-brand-ink hover:underline dark:text-white">
            {save.title || `${describeLink(save)} · ${displayHost(save.url)}`}
          </a>
          {save.note && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600 dark:text-slate-300">{save.note}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Tags save={save} />
            <CollectionChips save={save} names={collectionNames} />
          </div>
        </div>
        {save.status === "active" && favoriteButton}
      </li>
    );
  }

  return (
    <li data-save-id={save.id} tabIndex={0} className={cx(frame, "mb-4 break-inside-avoid p-3")}>
      <Header {...props} />
      <div className="mt-2">
        {save.status === "trashed" ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
            In the Trash{save.trashedAt ? ` since ${formatDay(save.trashedAt)}` : ""}. It's removed for good after 30 days.
          </p>
        ) : (
          <Preview save={save} theme={theme} mode={previews} disabledPlatforms={disabledPlatforms} onVerdict={(s) => actions.verdict(save, s)} />
        )}
      </div>
      {(save.title || save.note || save.tags.length > 0 || save.collectionIds.length > 0 || save.status === "active") && (
        <div className="mt-2 flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            {save.title && <p className="line-clamp-2 text-sm font-medium">{save.title}</p>}
            {save.note && <p className="line-clamp-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{save.note}</p>}
            <Tags save={save} />
            <CollectionChips save={save} names={collectionNames} />
          </div>
          {save.status === "active" && favoriteButton}
        </div>
      )}
    </li>
  );
}

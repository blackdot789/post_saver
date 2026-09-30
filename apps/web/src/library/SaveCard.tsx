import type { EmbedTheme, Platform } from "@postsaver/core";
import { estimatePreviewHeight, Preview, titleBelow } from "../embeds-host/Preview.tsx";
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

function OpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
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

function Header({ save, actions, selecting, selected, onToggleSelect, date }: Pick<SaveCardProps, "save" | "actions" | "selecting" | "selected" | "onToggleSelect"> & { date?: boolean }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      {selecting && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(save.id)}
          aria-label={`Select ${describeLink(save)}`}
          className="size-5 shrink-0 accent-brand-to"
        />
      )}
      <PlatformBadge platform={save.platform} />
      {save.author && <span className="truncate text-sm text-slate-500 dark:text-slate-400">{authorLabel(save.platform, save.author)}</span>}
      {date && <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">{when(save)}</span>}
      {!selecting && <Menu label={`Actions for ${describeLink(save)}`} items={menuItems(save, actions)} className={date ? undefined : "ml-auto"} />}
    </div>
  );
}

const when = (save: LibrarySave): string => (save.pending ? "Syncing…" : save.savedAt ? formatDay(save.savedAt) : "");

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

// Rough heights of a grid card's parts, for laying out the grid before a card is measured.
const CARD_HEADER = 48;
const CARD_FOOTER = 46;
const TRASH_NOTE = 72;

/** Roughly how tall a save's grid card is in a column this wide (see Masonry). */
export function estimateCardHeight(save: LibrarySave, width: number, previews: "always" | "click", disabledPlatforms: readonly Platform[]): number {
  const preview = save.status === "trashed" ? TRASH_NOTE : estimatePreviewHeight(save, width, previews, disabledPlatforms);
  const text = (save.title && titleBelow(save.platform) ? 28 : 0) + (save.note ? 28 : 0) + (save.tags.length > 0 ? 28 : 0) + (save.collectionIds.length > 0 ? 20 : 0);
  return CARD_HEADER + preview + text + CARD_FOOTER;
}

/** One save, as a card in the grid (with its preview) or a compact row in the list. */
export function SaveCard(props: SaveCardProps) {
  const { save, layout, theme, previews, disabledPlatforms, collectionNames, actions, selected } = props;
  const frame = cx(
    "border bg-white transition-[border-color,box-shadow] dark:bg-white/5",
    selected ? "border-brand-from ring-2 ring-brand-from/30" : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-from",
  );
  const favoriteButton = (
    <button
      type="button"
      onClick={() => actions.favorite(save)}
      aria-pressed={save.favorite}
      aria-label={save.favorite ? "Remove from favorites" : "Add to favorites"}
      className={cx("grid size-9 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10", save.favorite ? "text-amber-500" : "text-slate-400")}
    >
      <StarIcon filled={save.favorite} className="size-5" />
    </button>
  );

  if (layout === "list") {
    return (
      <div data-save-id={save.id} tabIndex={0} className={cx(frame, "flex items-start gap-3 rounded-2xl px-4 py-2.5")}>
        <div className="min-w-0 flex-1">
          <Header {...props} date />
          <a href={save.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-brand-ink hover:underline dark:text-white">
            {save.title || `${describeLink(save)} · ${displayHost(save.url)}`}
          </a>
          {save.note && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600 dark:text-slate-300">{save.note}</p>}
          {(save.tags.length > 0 || save.collectionIds.length > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Tags save={save} />
              <CollectionChips save={save} names={collectionNames} />
            </div>
          )}
        </div>
        {save.status === "active" && favoriteButton}
      </div>
    );
  }

  // The title is printed here for players that don't show one, and for anything in the Trash
  // (which has no preview); otherwise the embed or the link card shows it.
  const title = titleBelow(save.platform) || save.status === "trashed" ? save.title : undefined;
  const hasText = !!(title || save.note || save.tags.length > 0 || save.collectionIds.length > 0);
  return (
    <article data-save-id={save.id} tabIndex={0} aria-label={describeLink(save)} className={cx(frame, "rounded-2xl shadow-xs hover:shadow-md")}>
      <div className="py-1.5 pr-1.5 pl-3.5">
        <Header {...props} />
      </div>
      {save.status === "trashed" ? (
        <p className="mx-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
          In the Trash{save.trashedAt ? ` since ${formatDay(save.trashedAt)}` : ""}. It's removed for good after 30 days.
        </p>
      ) : (
        <Preview save={save} theme={theme} mode={previews} disabledPlatforms={disabledPlatforms} onVerdict={(s) => actions.verdict(save, s)} />
      )}
      {hasText && (
        <div className="space-y-1.5 px-3.5 pt-3">
          {title && <p className="line-clamp-2 text-sm leading-snug font-semibold">{title}</p>}
          {save.note && <p className="line-clamp-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{save.note}</p>}
          <Tags save={save} />
          <CollectionChips save={save} names={collectionNames} />
        </div>
      )}
      <div className="flex items-center gap-1 py-1 pr-1.5 pl-3.5">
        <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">{when(save)}</span>
        {save.status === "active" && (
          <>
            <a
              href={save.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open original"
              title="Open original"
              className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand-ink dark:hover:bg-white/10 dark:hover:text-white"
            >
              <OpenIcon className="size-[18px]" />
            </a>
            {favoriteButton}
          </>
        )}
      </div>
    </article>
  );
}

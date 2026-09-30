import { authorLabel, describeLink, formatDay } from "../../lib/platforms.ts";
import type { LibrarySave } from "../../sync/library.ts";
import { ButtonLink } from "../../ui/Button.tsx";

/** The saves as a plain list, newest first. The real library (grid, search, filters) is step 7. */
export function SavesList({ saves }: { saves: LibrarySave[] }) {
  if (saves.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-white/15">
        <p className="text-lg font-semibold">Nothing saved yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-slate-600 dark:text-slate-300">
          Paste the link to a post from any app, and it shows up here on all your devices.
        </p>
        <ButtonLink href="/save/" size="sm" className="mt-5">
          Save a link
        </ButtonLink>
      </div>
    );
  }
  return (
    <ul aria-label="Saves" className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white/60 px-5 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
      {saves.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {describeLink(row)}
              {row.author && <span className="font-normal text-slate-500 dark:text-slate-400"> · {authorLabel(row.platform, row.author)}</span>}
            </p>
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-sm text-blue-600 underline-offset-4 hover:underline dark:text-sky-400"
            >
              {row.url}
            </a>
            {row.tags.length > 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.tags.map((t) => `#${t}`).join("  ")}</p>
            )}
          </div>
          <span className="shrink-0 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {row.pending ? "Syncing…" : row.savedAt ? formatDay(row.savedAt) : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

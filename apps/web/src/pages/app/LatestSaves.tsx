import { useEffect, useState } from "react";
import { watchLatest, type SaveRow } from "../../data/latest.ts";
import { authorLabel, describeLink, formatDay } from "../../lib/platforms.ts";
import { errorMessage } from "../save/messages.ts";
import { Alert } from "../../ui/Alert.tsx";
import { ButtonLink } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";

const COUNT = 20;

/** The newest saves as a plain list, updating live (a post shared on the phone appears here). */
export function LatestSaves({ uid }: { uid: string }) {
  const [rows, setRows] = useState<SaveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => watchLatest(uid, COUNT, setRows, (e) => setError(errorMessage(e))), [uid]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rows) return <PageSpinner label="Loading your saves…" />;
  if (rows.length === 0) {
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
    <ul aria-label="Latest saves" className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white/60 px-5 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
      {rows.map((row) => (
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

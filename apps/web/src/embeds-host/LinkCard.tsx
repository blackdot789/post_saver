import type { ReactNode } from "react";
import { displayHost } from "../lib/platforms.ts";
import { cx } from "../ui/cx.ts";

interface LinkCardProps {
  url: string;
  title?: string;
  /** Why there's no preview, e.g. "This post is no longer available." */
  reason?: string;
  action?: ReactNode;
  className?: string;
}

/** What a save shows when there's no preview: the link, its site, and the reason if any. */
export function LinkCard({ url, title, reason, action, className }: LinkCardProps) {
  return (
    <div className={cx("rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5", className)}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{displayHost(url)}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 line-clamp-2 block text-sm font-semibold break-all text-brand-ink underline-offset-4 hover:underline dark:text-white"
      >
        {title || url}
      </a>
      {reason && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{reason}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

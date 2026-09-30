import type { ReactNode } from "react";
import type { Platform } from "@postsaver/core";
import { PlatformIcon } from "../lib/PlatformBadge.tsx";
import { displayHost } from "../lib/platforms.ts";
import { cx } from "../ui/cx.ts";

interface LinkCardProps {
  url: string;
  platform: Platform;
  /** The post's title, when it's known and the card around this doesn't show it. */
  title?: string | undefined;
  /** Why there's no preview, e.g. "This post is no longer available." */
  reason?: string;
  action?: ReactNode;
  className?: string;
}

/** The part of a link after its host, without a trailing slash: "/p/abc" or "" for a home page. */
function pathOf(url: string): string {
  try {
    const { pathname, search } = new URL(url);
    const path = decodeURI(pathname).replace(/\/$/, "") + search;
    return path;
  } catch {
    return "";
  }
}

/** What a save shows when there's no preview: where the link goes, and the reason if any. */
export function LinkCard({ url, platform, title, reason, action, className }: LinkCardProps) {
  const path = pathOf(url);
  const host = displayHost(url);
  return (
    <div className={cx("mx-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5", className)}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="group/link flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/10">
          <PlatformIcon platform={platform} className="size-5" />
        </span>
        {title ? (
          <span className="min-w-0">
            <span className="line-clamp-2 text-sm leading-snug font-semibold text-brand-ink underline-offset-4 group-hover/link:underline dark:text-white">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
              {host}
              {path}
            </span>
          </span>
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-brand-ink underline-offset-4 group-hover/link:underline dark:text-white">{host}</span>
            {path && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{path}</span>}
          </span>
        )}
      </a>
      {reason && <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300">{reason}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

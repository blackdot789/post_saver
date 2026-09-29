import type { ParsedLink } from "@postsaver/core";
import { authorLabel, describeLink } from "../../lib/platforms.ts";
import { cx } from "../../ui/cx.ts";

/** What's being saved: the kind of post, who posted it, and the clean link. */
export function LinkPreview({ link, className }: { link: ParsedLink; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5", className)}>
      <p className="text-sm font-semibold">
        {describeLink(link)}
        {link.author && (
          <span className="font-normal text-slate-500 dark:text-slate-400"> · {authorLabel(link.platform, link.author)}</span>
        )}
      </p>
      <a
        href={link.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-sm break-all text-blue-600 underline-offset-4 hover:underline dark:text-sky-400"
      >
        {link.canonicalUrl}
      </a>
    </div>
  );
}

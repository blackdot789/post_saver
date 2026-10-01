import { cx } from "../../ui/cx.ts";

/** The text being saved, as written (its line breaks kept), cut after a few lines. */
export function TextPreview({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5", className)}>
      <p className="text-sm font-semibold">Text</p>
      <p data-saved-text className="mt-1 line-clamp-6 text-sm break-words whitespace-pre-wrap text-slate-700 dark:text-slate-300">
        {text}
      </p>
    </div>
  );
}

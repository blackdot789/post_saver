import { cx } from "./cx.ts";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx("size-5 motion-safe:animate-spin", className)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A centred spinner with a label for screen readers, for whole-page loading states. */
export function PageSpinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-slate-500 dark:text-slate-400">
      <Spinner className="size-7 text-brand-from" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

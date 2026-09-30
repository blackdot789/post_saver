import type { Library } from "../../sync/useLibrary.ts";
import { cx } from "../../ui/cx.ts";
import { Spinner } from "../../ui/Spinner.tsx";

function label(library: Library): { text: string; detail: string; tone: string } {
  switch (library.status) {
    case "synced":
      return { text: "Synced", detail: "Your library is up to date on this device.", tone: "text-emerald-700 dark:text-emerald-300" };
    case "syncing":
      return { text: "Syncing…", detail: "Fetching changes from your other devices.", tone: "text-slate-600 dark:text-slate-300" };
    case "offline":
      return {
        text: library.pendingCount > 0 ? `Offline · ${library.pendingCount} waiting` : "Offline",
        detail: "Your saves are kept on this device and sync when you're back online.",
        tone: "text-slate-500 dark:text-slate-400",
      };
    case "paused":
      return {
        text: "Sync paused until tomorrow",
        detail: "The service reached its daily limit. Your saves are safe on this device and sync tomorrow.",
        tone: "text-amber-700 dark:text-amber-300",
      };
  }
}

/** The small sync indicator in the library header. */
export function SyncStatus({ library, className }: { library: Library; className?: string }) {
  const { text, detail, tone } = label(library);
  return (
    <span
      role="status"
      title={detail}
      data-sync-mode={library.mode}
      className={cx("inline-flex items-center gap-1.5 text-sm font-medium", tone, className)}
    >
      {library.status === "syncing" ? (
        <Spinner className="size-3.5" />
      ) : (
        <span aria-hidden="true" className={cx("size-2 rounded-full", library.status === "synced" ? "bg-emerald-500" : library.status === "paused" ? "bg-amber-500" : "bg-slate-400")} />
      )}
      {text}
    </span>
  );
}

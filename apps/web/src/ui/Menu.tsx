import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx.ts";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** e.g. delete actions. */
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  /** The button's contents; defaults to a "⋯" glyph. */
  children?: ReactNode;
  className?: string;
}

/** A small dropdown of actions. Closes on Escape, a click outside, or choosing an item. */
export function Menu({ label, items, children, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cx("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-from dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        {children ?? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#0b1430]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10",
                item.danger ? "text-red-700 dark:text-red-300" : "",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

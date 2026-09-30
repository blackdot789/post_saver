import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import { CloseIcon } from "./icons.tsx";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons at the bottom. */
  footer?: ReactNode;
}

/** A modal on the native <dialog>: focus trapping, Escape and the backdrop come for free. */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-0 text-brand-ink shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm open:flex open:flex-col dark:border-white/10 dark:bg-[#0b1430] dark:text-slate-100"
    >
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
        <h2 id="dialog-title" className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        <Button variant="secondary" size="sm" aria-label="Close" onClick={onClose} className="px-2">
          <CloseIcon className="size-4" />
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 pb-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">{footer}</div>}
    </dialog>
  );
}

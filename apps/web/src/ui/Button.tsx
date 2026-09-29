import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx.ts";
import { Spinner } from "./Spinner.tsx";

type Variant = "primary" | "secondary" | "link";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-linear-to-r from-brand-from to-brand-to text-white shadow-sm hover:brightness-110",
  secondary:
    "border border-slate-300 bg-white text-brand-ink hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10",
  // The brand blue is too light for small text on white (about 3:1), so links use a deeper blue.
  link: "text-blue-600 underline-offset-4 hover:underline dark:text-sky-400",
};

const SIZES: Record<Size, string> = {
  // Full width with a 48px tap target: the main actions on a page.
  md: "w-full rounded-xl px-4 py-3 text-base",
  sm: "rounded-lg px-3 py-2 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while an action runs. */
  busy?: boolean;
}

export function Button({ variant = "primary", size = "md", busy = false, disabled, className, children, type, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? "button"}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-from",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variant === "link" ? "rounded-md px-1 py-1" : SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {busy && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

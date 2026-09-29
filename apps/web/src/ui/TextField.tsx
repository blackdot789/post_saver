import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx.ts";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
}

const INPUT =
  "block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-brand-ink placeholder:text-slate-400 " +
  "focus:border-brand-from focus:outline-3 focus:outline-brand-from/25 " +
  "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500";

export function TextField({ label, hint, className, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={INPUT} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A password input with a Show/Hide toggle (handy on phones). */
export function PasswordField({ label, hint, className, ...input }: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cx(INPUT, "pr-18")}
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute inset-y-0 right-0 px-3.5 text-sm font-medium text-slate-500 hover:text-brand-ink dark:text-slate-400 dark:hover:text-white"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
}

export function TextArea({ label, hint, className, ...textarea }: TextAreaProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cx(INPUT, "resize-y")} {...textarea} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

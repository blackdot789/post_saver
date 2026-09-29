import type { ReactNode } from "react";
import { site } from "@postsaver/config";

/** The brand mark and name, linking home. */
export function BrandLink({ className }: { className?: string }) {
  return (
    <a href="/" className={className ?? "flex items-center gap-2.5 font-semibold"}>
      <img src="/icons/mark.svg" alt="" width="36" height="34" className="h-8 w-auto" />
      <span className="text-lg tracking-tight">{site.brand.name}</span>
    </a>
  );
}

/** Centered card on the brand background, used by the sign-in pages. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-[70%] rounded-full bg-brand-from/20 blur-3xl dark:bg-brand-from/25" />
        <div className="absolute top-24 left-1/2 h-[26rem] w-[26rem] -translate-x-[10%] rounded-full bg-brand-to/15 blur-3xl dark:bg-brand-to/25" />
      </div>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <BrandLink className="mx-auto flex items-center gap-2.5 font-semibold" />
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8 dark:border-white/10 dark:bg-white/5">
          {children}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Need help?{" "}
          <a className="underline underline-offset-4 hover:text-brand-ink dark:hover:text-white" href={`mailto:${site.contact.support}`}>
            {site.contact.support}
          </a>
        </p>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { loginUrl } from "../../auth/next.ts";
import { signOut } from "../../auth/session.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { BrandLink } from "../../ui/AuthLayout.tsx";
import { Button } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";

function Shell({ user }: { user: User }) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-night/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <BrandLink />
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-slate-500 sm:inline dark:text-slate-400">{user.email}</span>
            <Button
              variant="secondary"
              size="sm"
              busy={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">You're signed in</h1>
        <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-300">
          Your account is ready. Your library, and saving posts from other apps, arrive in the next updates.
        </p>
      </main>
    </div>
  );
}

/** The library. For now: proves sign-in works end to end, and sends everyone else to sign in. */
export function AppPage() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "signed-out" || auth.status === "unverified") {
      location.replace(loginUrl(location.pathname + location.search));
    }
  }, [auth.status]);

  if (auth.status !== "ready") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <PageSpinner label="Loading your library…" />
      </div>
    );
  }
  return <Shell user={auth.user} />;
}

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { loginUrl } from "../../auth/next.ts";
import { signOut } from "../../auth/session.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { savePending } from "../../capture/saveLink.ts";
import { ensureProfile } from "../../data/profile.ts";
import { Alert } from "../../ui/Alert.tsx";
import { BrandLink } from "../../ui/AuthLayout.tsx";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";
import { LatestSaves } from "./LatestSaves.tsx";

function Shell({ user }: { user: User }) {
  const [signingOut, setSigningOut] = useState(false);
  const [caughtUp, setCaughtUp] = useState(0);

  // Links shared on this device before signing in (kept by /save/ and /share/) are saved now.
  useEffect(() => {
    ensureProfile(user).catch(() => undefined);
    savePending(user.uid).then(setCaughtUp, () => undefined);
  }, [user]);

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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your library</h1>
            <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">
              Your latest saves. Previews, search, tags and collections arrive in the next updates.
            </p>
          </div>
          <ButtonLink href="/save/" size="sm">
            Save a link
          </ButtonLink>
        </div>
        {caughtUp > 0 && (
          <Alert tone="success" className="mb-6">
            {caughtUp === 1 ? "The link you shared before signing in is saved." : `The ${caughtUp} links you shared before signing in are saved.`}
          </Alert>
        )}
        <LatestSaves uid={user.uid} />
      </main>
    </div>
  );
}

/** The library. For now: the latest saves (the full library is step 7); sends everyone else to sign in. */
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

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { loginUrl } from "../../auth/next.ts";
import { signOut } from "../../auth/session.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { savePending } from "../../capture/saveLink.ts";
import { watchAppConfig, type RemoteConfig } from "../../data/appConfig.ts";
import { clearLocalData } from "../../data/firestore.ts";
import { ensureProfile } from "../../data/profile.ts";
import { useLibrary } from "../../sync/useLibrary.ts";
import { Alert } from "../../ui/Alert.tsx";
import { BrandLink } from "../../ui/AuthLayout.tsx";
import { Button, ButtonLink } from "../../ui/Button.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";
import { errorMessage } from "../save/messages.ts";
import { SavesList } from "./SavesList.tsx";
import { SyncStatus } from "./SyncStatus.tsx";

/** Remote notices from config/app (CLAUDE.md §6.4). */
function useAppConfig(): RemoteConfig {
  const [config, setConfig] = useState<RemoteConfig>({});
  useEffect(() => watchAppConfig(setConfig), []);
  return config;
}

function Shell({ user }: { user: User }) {
  const [signingOut, setSigningOut] = useState(false);
  const [caughtUp, setCaughtUp] = useState(0);
  const library = useLibrary(user.uid);
  const config = useAppConfig();

  // Links shared on this device before signing in (kept by /save/ and /share/) are saved now.
  useEffect(() => {
    ensureProfile(user).catch(() => undefined);
    savePending(user.uid).then(setCaughtUp, () => undefined);
  }, [user]);

  // Wipe this device's copy of the library, then sign out (the auth change sends us to sign-in).
  async function leave() {
    setSigningOut(true);
    await clearLocalData();
    await signOut();
  }

  const trashed = library.saves.filter((s) => s.status === "trashed").length;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-night/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <BrandLink />
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <SyncStatus library={library} />
            <span className="hidden truncate text-sm text-slate-500 md:inline dark:text-slate-400">{user.email}</span>
            <Button variant="secondary" size="sm" busy={signingOut} onClick={() => void leave()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        {config.maintenance && (
          <Alert tone="warning" className="mb-6" title="Maintenance in progress">
            Saving and syncing may pause for a short while. Nothing is lost.
          </Alert>
        )}
        {config.notice && (
          <Alert tone="info" className="mb-6">
            {config.notice}
          </Alert>
        )}
        {library.status === "paused" && (
          <Alert tone="warning" className="mb-6">
            Cloud sync is paused until tomorrow because the service reached its daily limit. Your saves are safe on this device.
          </Alert>
        )}
        {library.problem && (
          <Alert tone="error" className="mb-6">
            Syncing stopped: {errorMessage({ code: library.problem })}
          </Alert>
        )}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your library</h1>
            <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">
              Your saves, newest first. Previews, search, tags and collections arrive in the next updates.
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
        {library.loaded ? <SavesList saves={library.saves.filter((s) => s.status === "active")} /> : <PageSpinner label="Loading your saves…" />}
        {trashed > 0 && (
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {trashed === 1 ? "1 save is in the Trash." : `${trashed} saves are in the Trash.`} The Trash view comes with the library.
          </p>
        )}
      </main>
    </div>
  );
}

/** The library. For now: the saves as a list (the full library is step 7); sends everyone else to sign in. */
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

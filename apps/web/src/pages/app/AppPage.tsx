import { useEffect } from "react";
import { loginUrl } from "../../auth/next.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { isFramed } from "../../lib/framed.ts";
import { LibraryPage } from "../../library/LibraryPage.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";

/** The library; sends signed-out and unverified visitors to sign in. */
export function AppPage() {
  const auth = useAuth();

  useEffect(() => {
    if (isFramed()) return;
    if (auth.status === "signed-out" || auth.status === "unverified") {
      location.replace(loginUrl(location.pathname + location.search));
    }
  }, [auth.status]);

  // Never inside another site's frame: a hidden frame could trick someone into a click.
  if (isFramed()) {
    return (
      <p className="p-8 text-center">
        <a href={location.href} target="_top" rel="noopener" className="text-blue-600 underline underline-offset-4 dark:text-sky-400">
          Open your library in its own tab
        </a>
      </p>
    );
  }
  if (auth.status !== "ready") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <PageSpinner label="Loading your library…" />
      </div>
    );
  }
  return <LibraryPage user={auth.user} />;
}

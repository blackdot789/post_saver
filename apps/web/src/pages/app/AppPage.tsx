import { useEffect } from "react";
import { loginUrl } from "../../auth/next.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { LibraryPage } from "../../library/LibraryPage.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";

/** The library; sends signed-out and unverified visitors to sign in. */
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
  return <LibraryPage user={auth.user} />;
}

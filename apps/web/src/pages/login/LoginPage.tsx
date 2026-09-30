import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { site } from "@postsaver/config";
import { currentBrowser, googleFlow } from "../../auth/environment.ts";
import { authErrorMessage } from "../../auth/errors.ts";
import { safeNext } from "../../auth/next.ts";
import {
  MIN_PASSWORD_LENGTH,
  completeGoogleRedirect,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "../../auth/session.ts";
import { useAuth } from "../../auth/useAuth.ts";
import { Alert, type Tone } from "../../ui/Alert.tsx";
import { AuthLayout } from "../../ui/AuthLayout.tsx";
import { Button } from "../../ui/Button.tsx";
import { GoogleIcon } from "../../ui/icons.tsx";
import { PageSpinner } from "../../ui/Spinner.tsx";
import { PasswordField, TextField } from "../../ui/TextField.tsx";
import { InAppNotice } from "./InAppNotice.tsx";
import { VerifyEmail } from "./VerifyEmail.tsx";

type Mode = "signin" | "signup" | "reset";
export interface Notice {
  tone: Tone;
  text: string;
}

const HEADINGS: Record<Mode, [string, string]> = {
  signin: ["Welcome back", "Sign in to your library."],
  signup: ["Create your account", `Save posts from every app in one place with ${site.brand.name}.`],
  reset: ["Reset your password", "We'll email you a link to choose a new one."],
};

function noticeFromUrl(params: URLSearchParams): Notice | null {
  if (params.has("verified")) return { tone: "success", text: "Your email is verified. Sign in to continue." };
  if (params.has("reset")) return { tone: "success", text: "If you changed your password, sign in with the new one." };
  if (params.has("deleted")) return { tone: "success", text: "Your account and everything in it were deleted." };
  return null;
}

export function LoginPage() {
  const env = useMemo(currentBrowser, []);
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const next = safeNext(params.get("next"));
  const auth = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [notice, setNotice] = useState<Notice | null>(() => noticeFromUrl(params));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const report = useCallback((n: Notice | null) => setNotice(n), []);
  const fail = useCallback((error: unknown) => {
    const text = authErrorMessage(error);
    setNotice(text ? { tone: "error", text } : null);
  }, []);

  useEffect(() => {
    completeGoogleRedirect().catch(fail);
  }, [fail]);

  useEffect(() => {
    if (auth.status === "ready") location.replace(next);
  }, [auth.status, next]);

  if (auth.status === "loading" || auth.status === "ready") {
    return (
      <AuthLayout>
        <PageSpinner label={auth.status === "ready" ? "Signing you in…" : "Loading…"} />
      </AuthLayout>
    );
  }

  const noticeBox = notice && (
    <Alert tone={notice.tone} className="mb-5">
      {notice.text}
    </Alert>
  );

  if (auth.status === "unverified") {
    return (
      <AuthLayout>
        {noticeBox}
        <VerifyEmail user={auth.user} report={report} />
      </AuthLayout>
    );
  }

  function switchMode(to: Mode) {
    setMode(to);
    setNotice(null);
  }

  async function google() {
    setBusy("google");
    setNotice(null);
    try {
      await signInWithGoogle(env);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setNotice({ tone: "error", text: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    setBusy("email");
    try {
      if (mode === "signin") await signInWithEmail(email, password);
      else if (mode === "signup") await signUpWithEmail(email, password);
      else {
        await sendPasswordReset(email);
        setMode("signin");
        setNotice({
          tone: "success",
          text: `If there's an account for ${email.trim()}, we've emailed it a link to reset the password. Check your spam folder too.`,
        });
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  const [title, subtitle] = HEADINGS[mode];
  const googleBlocked = googleFlow(env) === "blocked";

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-300">{subtitle}</p>

      <div className="mt-6 space-y-5">
        {noticeBox}
        {mode !== "reset" && (
          <>
            <InAppNotice env={env} />
            <Button variant="secondary" onClick={google} busy={busy === "google"} disabled={googleBlocked || busy !== null}>
              {busy !== "google" && <GoogleIcon />}
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              or use your email
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== "reset" && (
            <PasswordField
              label="Password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              hint={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button type="submit" busy={busy === "email"} disabled={busy !== null}>
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
        {mode === "signin" && (
          <>
            <Button variant="link" className="text-sm" onClick={() => switchMode("reset")}>
              Forgot your password?
            </Button>
            <p>
              New here?{" "}
              <Button variant="link" className="text-sm" onClick={() => switchMode("signup")}>
                Create an account
              </Button>
            </p>
          </>
        )}
        {mode === "signup" && (
          <p>
            Already have an account?{" "}
            <Button variant="link" className="text-sm" onClick={() => switchMode("signin")}>
              Sign in
            </Button>
          </p>
        )}
        {mode === "reset" && (
          <Button variant="link" className="text-sm" onClick={() => switchMode("signin")}>
            Back to sign in
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}

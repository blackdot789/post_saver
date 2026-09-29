import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { authErrorMessage } from "../../auth/errors.ts";
import { VERIFY_SENT_KEY, refreshVerified, sendVerification, signOut } from "../../auth/session.ts";
import { readLocal } from "../../lib/storage.ts";
import { Button } from "../../ui/Button.tsx";
import { MailIcon } from "../../ui/icons.tsx";
import type { Notice } from "./LoginPage.tsx";

const RESEND_AFTER_S = 60;
const AUTO_CHECK_MS = 10_000;
const AUTO_CHECK_FOR_MS = 30 * 60_000;

function secondsLeft(): number {
  const sentAt = Number(readLocal(VERIFY_SENT_KEY) ?? 0);
  return Math.max(0, Math.ceil((sentAt + RESEND_AFTER_S * 1000 - Date.now()) / 1000));
}

/**
 * Seconds left before another verification email may be sent. Re-read every second, because
 * right after sign-up this screen appears before the first email has finished sending.
 */
function useCooldown(): [number, () => void] {
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft()), 1000);
    return () => clearInterval(timer);
  }, []);
  return [left, () => setLeft(secondsLeft())];
}

/** Shown while signed in with an unverified email. Moves on by itself once the link is opened. */
export function VerifyEmail({ user, report }: { user: User; report: (notice: Notice | null) => void }) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, restartCooldown] = useCooldown();

  const check = useCallback(
    async (manual: boolean) => {
      if (manual) {
        setChecking(true);
        report(null);
      }
      try {
        const verified = await refreshVerified();
        if (!verified && manual) {
          report({
            tone: "info",
            text: "Not verified yet. Open the link in the email, then try again. It can take a minute to arrive, so check your spam folder too.",
          });
        }
      } catch (error) {
        if (manual) report({ tone: "error", text: authErrorMessage(error) ?? "" });
      } finally {
        if (manual) setChecking(false);
      }
    },
    [report],
  );

  // Notice verification done elsewhere (another tab, or the phone) without a click.
  useEffect(() => {
    void check(false);
    const started = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    const timer = setInterval(() => {
      if (Date.now() - started > AUTO_CHECK_FOR_MS) clearInterval(timer);
      else if (document.visibilityState === "visible") void check(false);
    }, AUTO_CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  async function resend() {
    setSending(true);
    report(null);
    try {
      await sendVerification(user);
      restartCooldown();
      report({ tone: "success", text: `We sent another link to ${user.email}.` });
    } catch (error) {
      report({ tone: "error", text: authErrorMessage(error) ?? "" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-from to-brand-to text-white">
        <MailIcon className="size-6" />
      </div>
      <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">Check your email</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-300">
        We sent a link to <strong className="font-semibold break-all text-brand-ink dark:text-white">{user.email}</strong>. Open
        it to verify your address, then come back here.
      </p>
      <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
        This keeps anyone else from making an account with your email.
      </p>

      <div className="mt-6 space-y-3">
        <Button onClick={() => check(true)} busy={checking}>
          I've verified it
        </Button>
        <Button variant="secondary" onClick={resend} busy={sending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the email again"}
        </Button>
      </div>
      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        Wrong address?{" "}
        <Button variant="link" className="text-sm" onClick={() => void signOut()}>
          Use a different account
        </Button>
      </p>
    </div>
  );
}

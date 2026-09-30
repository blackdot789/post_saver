import { useEffect, useMemo, useRef, useState } from "react";
import { parse, type EmbedTheme, type Platform } from "@postsaver/core";
import { PLATFORM_NAMES } from "../lib/platforms.ts";
import type { LibrarySave } from "../sync/library.ts";
import { Button } from "../ui/Button.tsx";
import { EmbedFrame, type FrameStatus } from "./EmbedFrame.tsx";
import { LinkCard } from "./LinkCard.tsx";
import { rememberedHeight } from "./loading.ts";

// What a save shows in its card: the platform's embed (in the sandbox), or a link card when
// there is no embed, previews are off, the post is gone, or the embed didn't load.

/** An "unavailable" verdict is trusted for this long, then the embed is tried again. */
const RECHECK_AFTER_MS = 7 * 24 * 3600 * 1000;
/** Frames mount when within this distance of the viewport. */
const NEAR_VIEWPORT = "600px";

export interface PreviewProps {
  save: LibrarySave;
  theme: EmbedTheme;
  /** "always": load when near the viewport · "click": only after a tap. */
  mode: "always" | "click";
  disabledPlatforms: readonly Platform[];
  /** The sandbox's verdict, to record on the save (unavailable / back to ok). */
  onVerdict: (status: "ok" | "unavailable") => void;
}

const REASONS: Record<Exclude<FrameStatus, "loading" | "ok">, string> = {
  unavailable: "This post is no longer available on the platform.",
  blocked: "The preview was blocked, most likely by an ad-blocker or a network filter.",
  timeout: "The preview didn't load in time.",
};

export function Preview({ save, theme, mode, disabledPlatforms, onVerdict }: PreviewProps) {
  const embed = useMemo(() => parse(save.url)?.embed ?? null, [save.url]);
  const [wanted, setWanted] = useState(mode === "always");
  const [near, setNear] = useState(false);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const verdict = useRef(onVerdict);
  useEffect(() => {
    verdict.current = onVerdict;
  });
  useEffect(() => {
    if (mode === "always") setWanted(true);
  }, [mode]);

  useEffect(() => {
    const el = holder.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) return setNear(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_VIEWPORT },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // The holder only exists once a preview is wanted (and again after a retry).
  }, [near, wanted, attempt]);

  const disabled = disabledPlatforms.includes(save.platform);
  const knownGone =
    save.embedStatus === "unavailable" && (!save.embedCheckedAt || Date.now() - save.embedCheckedAt.getTime() < RECHECK_AFTER_MS) && attempt === 0;

  const retry = (
    <Button variant="secondary" size="sm" onClick={() => {
      setStatus("loading");
      setAttempt((n) => n + 1);
      setWanted(true);
    }}>
      Try again
    </Button>
  );

  if (!embed) return <LinkCard url={save.url} title={save.title} />;
  if (disabled) return <LinkCard url={save.url} title={save.title} reason={`Previews from ${PLATFORM_NAMES[save.platform]} are turned off for now.`} />;
  if (knownGone) return <LinkCard url={save.url} title={save.title} reason={REASONS.unavailable} action={retry} />;
  if (!wanted) {
    return (
      <LinkCard
        url={save.url}
        title={save.title}
        action={
          <Button variant="secondary" size="sm" onClick={() => setWanted(true)}>
            Show preview
          </Button>
        }
      />
    );
  }
  if (status !== "loading" && status !== "ok") {
    return <LinkCard url={save.url} title={save.title} reason={REASONS[status]} action={retry} />;
  }

  const placeholder = rememberedHeight(save.id) ?? 240;
  return (
    <div ref={holder} data-preview={status} style={near ? undefined : { minHeight: placeholder }}>
      {near && (
        <EmbedFrame
          key={attempt}
          id={save.id}
          embed={embed}
          theme={theme}
          title={`${PLATFORM_NAMES[save.platform]} preview`}
          onStatus={(s) => {
            setStatus(s);
            if (s === "unavailable") verdict.current("unavailable");
            else if (s === "ok" && save.embedStatus === "unavailable") verdict.current("ok");
          }}
        />
      )}
    </div>
  );
}

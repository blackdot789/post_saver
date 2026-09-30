import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parse, type Embed, type EmbedTheme, type Platform } from "@postsaver/core";
import { PLATFORM_NAMES } from "../lib/platforms.ts";
import type { LibrarySave } from "../sync/library.ts";
import { Button } from "../ui/Button.tsx";
import { cx } from "../ui/cx.ts";
import { EmbedFrame, type FrameStatus } from "./EmbedFrame.tsx";
import { LinkCard } from "./LinkCard.tsx";
import { rememberedSize, rememberSize } from "./loading.ts";
import { fitPreview, initialPreviewHeight, maxPreviewHeight, type PreviewSize } from "./sizing.ts";

// What a save shows in its card: the platform's embed (in the sandbox), or a link card when
// there is no embed, previews are off, the post is gone, or the embed didn't load. An embed is
// shown at the size sizing.ts gives it; a taller one is cut there, with a button under it (never
// over it) that shows the rest.

/** An "unavailable" verdict is trusted for this long, then the embed is tried again. */
const RECHECK_AFTER_MS = 7 * 24 * 3600 * 1000;
/** Frames mount when within this distance of the viewport. */
const NEAR_VIEWPORT = "600px";
/** The card's width before it has been measured. */
const ASSUMED_WIDTH = 320;
/** Rough heights, for laying out the grid before a card has been measured. */
const LINK_CARD_HEIGHT = 66;
const LINK_CARD_WITH_ACTION_HEIGHT = 118;
const FOLD_BAR_HEIGHT = 37;

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

/**
 * Where a save's title goes. These platforms' players don't show one, so the card prints it
 * under the preview; every other embed shows the post's own text, so the title appears only
 * when there's a link card instead of the embed.
 */
export function titleBelow(platform: Platform): boolean {
  return platform === "youtube" || platform === "tiktok";
}

const embeds = new Map<string, Embed | null>();

/** The embed for a saved link, or null for a link card. Parsed once per link. */
function embedFor(url: string): Embed | null {
  let embed = embeds.get(url);
  if (embed === undefined) {
    embed = parse(url)?.embed ?? null;
    embeds.set(url, embed);
  }
  return embed;
}

function knownGone(save: LibrarySave): boolean {
  return save.embedStatus === "unavailable" && (!save.embedCheckedAt || Date.now() - save.embedCheckedAt.getTime() < RECHECK_AFTER_MS);
}

/** Roughly how tall a save's preview is in a card this wide, before it has been measured. */
export function estimatePreviewHeight(save: LibrarySave, width: number, mode: "always" | "click", disabledPlatforms: readonly Platform[]): number {
  if (!embedFor(save.url) || disabledPlatforms.includes(save.platform)) return LINK_CARD_HEIGHT;
  if (mode === "click" || knownGone(save)) return LINK_CARD_WITH_ACTION_HEIGHT;
  const known = rememberedSize(save.id, width);
  if (!known) return initialPreviewHeight(save.platform, save.kind, width);
  const fit = fitPreview(known, maxPreviewHeight(width));
  return fit.shown + (fit.cut ? FOLD_BAR_HEIGHT : 0);
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={cx("size-3.5 transition-transform motion-reduce:transition-none", up && "rotate-180")}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Preview({ save, theme, mode, disabledPlatforms, onVerdict }: PreviewProps) {
  const embed = embedFor(save.url);
  const [wanted, setWanted] = useState(mode === "always");
  const [near, setNear] = useState(false);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState<PreviewSize | null>(null);
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const verdict = useRef(onVerdict);
  useEffect(() => {
    verdict.current = onVerdict;
  });
  useEffect(() => {
    if (mode === "always") setWanted(true);
  }, [mode]);

  // The card's width decides every size below, so it's measured before the first paint.
  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
    // The holder only exists once a preview is wanted (and again after a retry).
  }, [wanted, attempt, status === "loading" || status === "ok"]);

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
  }, [near, wanted, attempt]);

  const retry = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        setStatus("loading");
        setSize(null);
        setOpen(false);
        setAttempt((n) => n + 1);
        setWanted(true);
      }}
    >
      Try again
    </Button>
  );

  const title = titleBelow(save.platform) ? undefined : save.title;
  if (!embed) return <LinkCard url={save.url} platform={save.platform} title={title} />;
  if (disabledPlatforms.includes(save.platform)) {
    return <LinkCard url={save.url} platform={save.platform} title={title} reason={`Previews from ${PLATFORM_NAMES[save.platform]} are turned off for now.`} />;
  }
  if (knownGone(save) && attempt === 0) return <LinkCard url={save.url} platform={save.platform} title={title} reason={REASONS.unavailable} action={retry} />;
  if (!wanted) {
    return (
      <LinkCard
        url={save.url}
        platform={save.platform}
        title={title}
        action={
          <Button variant="secondary" size="sm" onClick={() => setWanted(true)}>
            Show preview
          </Button>
        }
      />
    );
  }
  if (status !== "loading" && status !== "ok") {
    return <LinkCard url={save.url} platform={save.platform} title={title} reason={REASONS[status]} action={retry} />;
  }

  const w = width || ASSUMED_WIDTH;
  const max = maxPreviewHeight(w);
  const placeholder = initialPreviewHeight(save.platform, save.kind, w);
  const known = size ?? rememberedSize(save.id, w);
  const fit = known ? fitPreview(known, max) : { shown: placeholder, cut: false };
  const shown = open && known ? known.height : fit.shown;
  const label = `${PLATFORM_NAMES[save.platform]} preview`;

  return (
    <div ref={holder} data-preview={status} data-cut={fit.cut ? (open ? "open" : "folded") : undefined}>
      <div className="relative overflow-hidden transition-[height] duration-200 motion-reduce:transition-none" style={{ height: shown }}>
        {status === "loading" && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-white/5" />}
        {near && width > 0 && (
          <div className="relative">
            <EmbedFrame
              key={attempt}
              embed={embed}
              theme={theme}
              tall={save.kind === "short"}
              maxHeight={max}
              initialHeight={known?.height ?? placeholder}
              title={label}
              onSize={(s) => {
                setSize(s);
                rememberSize(save.id, s, w);
              }}
              onStatus={(s) => {
                setStatus(s);
                if (s === "unavailable") verdict.current("unavailable");
                else if (s === "ok" && save.embedStatus === "unavailable") verdict.current("ok");
              }}
            />
          </div>
        )}
      </div>
      {fit.cut && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-200 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-from dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {open ? "Show less" : "Show full post"}
          <Chevron up={open} />
        </button>
      )}
    </div>
  );
}

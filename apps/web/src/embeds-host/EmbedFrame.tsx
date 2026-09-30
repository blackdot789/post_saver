import { useEffect, useRef, useState } from "react";
import { embedToParams, type Embed, type EmbedTheme } from "@postsaver/core";
import { embedOrigin } from "../lib/embedOrigin.ts";
import { acquireSlot } from "./loading.ts";
import type { PreviewSize } from "./sizing.ts";

// The host side of the embed sandbox (CLAUDE.md §6.6, §4.3): an iframe on embed.<domain> that
// is told what to render in its #fragment and answers with postMessage. Only messages from the
// sandbox's origin *and* this very frame are trusted.

export type FrameStatus = "loading" | "ok" | "unavailable" | "blocked" | "timeout";

/** No word from the sandbox for this long: shown as a link card instead. The sandbox's own
 * limits (apps/embed/src/render.ts) add up to less, so it normally answers first. */
export const FRAME_TIMEOUT_MS = 25_000;
const MAX_FRAME_HEIGHT = 6000;

export const FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation";

interface EmbedFrameProps {
  embed: Embed;
  theme: EmbedTheme;
  /** An upright video (a Short). */
  tall: boolean;
  /** The tallest the card shows a preview; passed on so players size themselves to fit. */
  maxHeight: number;
  /** The frame's height until the sandbox says how tall the embed is. */
  initialHeight: number;
  title: string;
  onStatus: (status: Exclude<FrameStatus, "loading">, reason?: string) => void;
  onSize: (size: PreviewSize) => void;
}

export function EmbedFrame({ embed, theme, tall, maxHeight, initialHeight, title, onStatus, onSize }: EmbedFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const [src, setSrc] = useState<string | null>(null);
  const release = useRef<(() => void) | null>(null);
  // The latest callbacks and limit, without restarting the frame when they change.
  const latest = useRef({ onStatus, onSize, maxHeight });
  useEffect(() => {
    latest.current = { onStatus, onSize, maxHeight };
  });

  // Wait for a loading slot, then point the frame at the sandbox.
  useEffect(() => {
    let cancelled = false;
    acquireSlot().then((r) => {
      if (cancelled) return r();
      release.current = r;
      setSrc(`${embedOrigin}/#${embedToParams(embed, { theme, tall, maxHeight: latest.current.maxHeight })}`);
    });
    return () => {
      cancelled = true;
      release.current?.();
      release.current = null;
    };
  }, [embed, theme, tall]);

  useEffect(() => {
    if (!src) return;
    let done = false;
    const finish = (status: Exclude<FrameStatus, "loading">, reason?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // Loaded or failed: either way the next frame in line may start.
      release.current?.();
      latest.current.onStatus(status, reason);
    };
    const timer = setTimeout(() => finish("timeout"), FRAME_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || !frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown; fold?: unknown; status?: unknown; reason?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "ps:height" && typeof data.height === "number" && data.height > 0) {
        const h = Math.min(Math.ceil(data.height), MAX_FRAME_HEIGHT);
        const fold = typeof data.fold === "number" && data.fold > 0 && data.fold < h ? Math.round(data.fold) : undefined;
        setHeight(h);
        latest.current.onSize(fold ? { height: h, fold } : { height: h });
      } else if (data.type === "ps:status") {
        const status = data.status === "ok" || data.status === "unavailable" || data.status === "blocked" ? data.status : "blocked";
        finish(status, typeof data.reason === "string" ? data.reason : undefined);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [src]);

  return (
    <iframe
      // A changed fragment alone wouldn't reload the sandbox.
      key={src}
      ref={frame}
      src={src ?? "about:blank"}
      title={title}
      sandbox={FRAME_SANDBOX}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      style={{ height }}
      className="block w-full border-0"
    />
  );
}

import { useEffect, useRef, useState } from "react";
import { embedToParams, type Embed, type EmbedTheme } from "@postsaver/core";
import { embedOrigin } from "../lib/embedOrigin.ts";
import { acquireSlot, rememberHeight, rememberedHeight } from "./loading.ts";

// The host side of the embed sandbox (CLAUDE.md §6.6, §4.3): an iframe on embed.<domain> that
// is told what to render in its #fragment and answers with postMessage. Only messages from the
// sandbox's origin *and* this very frame are trusted.

export type FrameStatus = "loading" | "ok" | "unavailable" | "blocked" | "timeout";

/** No word from the sandbox for this long: shown as a link card instead. */
export const FRAME_TIMEOUT_MS = 10_000;
const DEFAULT_HEIGHT = 360;

export const FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation";

interface EmbedFrameProps {
  /** The save's id, to remember the height under. */
  id: string;
  embed: Embed;
  theme: EmbedTheme;
  title: string;
  onStatus: (status: Exclude<FrameStatus, "loading">, reason?: string) => void;
}

export function EmbedFrame({ id, embed, theme, title, onStatus }: EmbedFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(() => rememberedHeight(id) ?? DEFAULT_HEIGHT);
  const [src, setSrc] = useState<string | null>(null);
  const report = useRef(onStatus);
  useEffect(() => {
    report.current = onStatus;
  });

  // Wait for a loading slot, then point the frame at the sandbox.
  useEffect(() => {
    let release: (() => void) | undefined;
    let cancelled = false;
    acquireSlot().then((r) => {
      if (cancelled) return r();
      release = r;
      setSrc(`${embedOrigin}/#${embedToParams(embed, theme)}`);
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [embed, theme]);

  useEffect(() => {
    if (!src) return;
    let done = false;
    const finish = (status: Exclude<FrameStatus, "loading">, reason?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      report.current(status, reason);
    };
    const timer = setTimeout(() => finish("timeout"), FRAME_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || !frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown; status?: unknown; reason?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "ps:height" && typeof data.height === "number" && data.height > 0) {
        const h = Math.min(Math.ceil(data.height), 6000);
        setHeight(h);
        rememberHeight(id, h);
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
  }, [src, id]);

  return (
    <iframe
      ref={frame}
      src={src ?? "about:blank"}
      title={title}
      sandbox={FRAME_SANDBOX}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      style={{ height }}
      className="block w-full border-0 transition-[height] duration-200 motion-reduce:transition-none"
    />
  );
}

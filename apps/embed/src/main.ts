/**
 * The embed sandbox (CLAUDE.md §6.6). It runs on its own origin, so platform scripts can never
 * reach the main app's storage or sign-in session. The parent (the main app) says what to show
 * in the URL fragment, e.g. #p=youtube&id=…&theme=dark; this page validates it, renders it with
 * the platform's official embed, and reports back with postMessage:
 *   { type: "ps:status", status: "ok" | "unavailable" | "blocked", reason? }
 *   { type: "ps:height", height, fold? }   fold: where the post itself ends and the platform's
 *                                          own footer (likes, "add a comment") begins
 * Messages go only to a parent origin from the config, and only such a parent is served.
 */
import { origins } from "@postsaver/config";
import { hintsFromParams, paramsToEmbed } from "@postsaver/core";
import { render, type Status } from "./render.ts";

const allowedParents = new Set<string>([origins.app, origins.www]);
if (import.meta.env.DEV) allowedParents.add("http://localhost:5173");
// End-to-end test builds: the main app's preview server.
if (import.meta.env.VITE_PARENT_ORIGIN) allowedParents.add(import.meta.env.VITE_PARENT_ORIGIN);

function parentOrigin(): string | null {
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : null;
    return ref && allowedParents.has(ref) ? ref : null;
  } catch {
    return null;
  }
}

const root = document.getElementById("frame");
const parent = parentOrigin();

function say(message: Record<string, unknown>): void {
  if (parent && window.parent !== window) window.parent.postMessage(message, parent);
}

function reportStatus(status: Status, reason?: string): void {
  say({ type: "ps:status", status, ...(reason ? { reason } : {}) });
}

let fold: number | null = null;

function reportHeight(): void {
  if (!root) return;
  const height = Math.ceil(root.getBoundingClientRect().height);
  say({ type: "ps:height", height, ...(fold && fold > 0 && fold < height ? { fold: Math.round(fold) } : {}) });
}

async function main(): Promise<void> {
  if (!root) return;
  if (!parent || window.parent === window) {
    root.textContent = "This page shows post previews inside the app.";
    return;
  }
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const hints = hintsFromParams(params);
  document.documentElement.dataset.theme = hints.theme;
  const embed = paramsToEmbed(params);
  if (!embed) return reportStatus("unavailable", "bad-link");

  new ResizeObserver(reportHeight).observe(root);
  try {
    const status = await render(embed, {
      root,
      theme: hints.theme,
      width: root.clientWidth || document.documentElement.clientWidth,
      maxHeight: hints.maxHeight,
      tall: hints.tall ?? false,
      fold(px) {
        fold = px;
        reportHeight();
      },
    });
    reportStatus(status);
  } catch (error) {
    reportStatus("blocked", error instanceof Error ? error.message : "error");
  }
  reportHeight();
}

void main();

/**
 * Embed sandbox (runs on its own origin so platform scripts can never reach the main app's
 * storage or sign-in session). Per-platform renderers land in Phase 1; for now it only
 * answers the parent so the host component can be wired up and tested.
 */
import { origins } from "@postsaver/config";

const allowedParents = new Set<string>([origins.app, origins.www]);
if (import.meta.env.DEV) allowedParents.add("http://localhost:5173");

function parentOrigin(): string | null {
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : null;
    return ref && allowedParents.has(ref) ? ref : null;
  } catch {
    return null;
  }
}

const target = parentOrigin();
if (target && window.parent !== window) {
  window.parent.postMessage({ type: "ps:status", status: "unavailable", reason: "not-implemented" }, target);
}

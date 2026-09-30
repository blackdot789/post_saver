import { useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./storage.ts";

// Installing the app (CLAUDE.md §6.1): Chrome and Edge announce that the site can be installed
// with a `beforeinstallprompt` event, which has to be kept to open the install dialog from our
// own button later. Other browsers install from their menu.

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** installed: done here before · available: our button can open the dialog · manual: from the browser's menu */
export type InstallState = "installed" | "available" | "manual";

const INSTALLED_KEY = "ps:installed";

let prompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Starts listening. Called when the page's script starts: the event can come before React does. */
export function watchInstall(): void {
  installed = standalone() || readLocal(INSTALLED_KEY) === "1";
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keeps Chrome's own banner away; the setup page has the button.
    event.preventDefault();
    prompt = event as InstallPromptEvent;
    // The browser offers to install, so the app isn't installed (any more).
    installed = standalone();
    notify();
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    installed = true;
    writeLocal(INSTALLED_KEY, "1");
    notify();
  });
}

const state = (): InstallState => (installed ? "installed" : prompt ? "available" : "manual");

/** Opens the browser's install dialog. Resolves with whether the person agreed. */
export async function install(): Promise<boolean> {
  const event = prompt;
  if (!event) return false;
  // The event can be used once.
  prompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state,
  );
}

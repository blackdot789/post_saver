import { onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { UserSettings } from "@postsaver/core";
import { readLocal, writeLocal } from "../lib/storage.ts";
import { userRef } from "./firestore.ts";

// users/{uid}.settings: view, theme, previews, onUnsave (CLAUDE.md §6.4). Kept in the profile
// document so every device agrees, with a copy in localStorage so the theme applies before the
// database answers.

export type Theme = NonNullable<UserSettings["theme"]>;
export type Previews = NonNullable<UserSettings["previews"]>;

const KEY = "ps:settings:";

/** Europe defaults to click-to-load previews (platform embeds set cookies). */
export function defaultPreviews(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): Previews {
  return timeZone?.startsWith("Europe/") ? "click" : "ask";
}

export function readSettings(uid: string): UserSettings {
  try {
    const parsed: unknown = JSON.parse(readLocal(KEY + uid) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as UserSettings) : {};
  } catch {
    return {};
  }
}

function pick(data: unknown): UserSettings {
  const s = (data as { settings?: unknown } | undefined)?.settings;
  if (!s || typeof s !== "object") return {};
  const { view, theme, previews, onUnsave } = s as Record<string, unknown>;
  return {
    ...(view === "grid" || view === "list" ? { view } : {}),
    ...(theme === "system" || theme === "light" || theme === "dark" ? { theme } : {}),
    ...(previews === "ask" || previews === "always" || previews === "click" ? { previews } : {}),
    ...(onUnsave === "remove" || onUnsave === "keep" ? { onUnsave } : {}),
  };
}

/** Applies the theme to the page: "system" leaves it to the OS. */
export function applyTheme(theme: Theme | undefined): void {
  const root = document.documentElement;
  if (!theme || theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** The account's settings, live, and a way to change them. */
export function useSettings(uid: string): [UserSettings, (patch: UserSettings) => void] {
  const [settings, setSettings] = useState<UserSettings>(() => readSettings(uid));
  // main.tsx reads the last account's theme before the first paint.
  useEffect(() => writeLocal("ps:last-uid", uid), [uid]);

  useEffect(
    () =>
      onSnapshot(
        userRef(uid),
        (snap) => {
          if (!snap.exists()) return;
          const next = pick(snap.data());
          setSettings(next);
          writeLocal(KEY + uid, JSON.stringify(next));
        },
        () => undefined,
      ),
    [uid],
  );

  const update = (patch: UserSettings) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeLocal(KEY + uid, JSON.stringify(next));
    const fields: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, value] of Object.entries(patch)) fields[`settings.${key}`] = value;
    // The profile may not exist yet on a brand-new offline device; the local copy still applies.
    updateDoc(userRef(uid), fields).catch(() => undefined);
  };

  return [settings, update];
}

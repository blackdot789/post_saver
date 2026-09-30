import { doc, onSnapshot } from "firebase/firestore";
import type { AppConfig } from "@postsaver/core";
import { getDb } from "./firestore.ts";

/** `config/app`, the remote switches (CLAUDE.md §6.4). Missing fields mean "nothing special". */
export type RemoteConfig = Partial<AppConfig>;

/** Follows `config/app` (public read; one read per visit plus changes). */
export function watchAppConfig(onChange: (config: RemoteConfig) => void): () => void {
  return onSnapshot(
    doc(getDb(), "config", "app"),
    (snap) => {
      const data = snap.data() ?? {};
      onChange({
        ...(typeof data.notice === "string" && data.notice.trim() ? { notice: data.notice.trim() } : {}),
        ...(typeof data.maintenance === "boolean" ? { maintenance: data.maintenance } : {}),
        ...(typeof data.minClientVersion === "string" ? { minClientVersion: data.minClientVersion } : {}),
        ...(Array.isArray(data.disabledEmbeds) ? { disabledEmbeds: data.disabledEmbeds } : {}),
        ...(typeof data.importPaused === "boolean" ? { importPaused: data.importPaused } : {}),
        ...(typeof data.importDailyCap === "number" ? { importDailyCap: data.importDailyCap } : {}),
        ...(typeof data.inboxEnabled === "boolean" ? { inboxEnabled: data.inboxEnabled } : {}),
      });
    },
    () => onChange({}),
  );
}

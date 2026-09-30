import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { signOut } from "../auth/session.ts";
import { savePending } from "../capture/saveLink.ts";
import { watchAppConfig, type RemoteConfig } from "../data/appConfig.ts";
import { watchCollections, type Collection } from "../data/collections.ts";
import { deleteSave, hardDeleteSave, restoreSave, setEmbedStatus, setFavorite, trashSave } from "../data/edits.ts";
import { clearLocalData } from "../data/firestore.ts";
import { ensureProfile } from "../data/profile.ts";
import { applyTheme, defaultPreviews, useSettings } from "../data/settings.ts";
import { errorMessage } from "../pages/save/messages.ts";
import { SyncStatus } from "../pages/app/SyncStatus.tsx";
import type { LibrarySave } from "../sync/library.ts";
import { useLibrary } from "../sync/useLibrary.ts";
import { Alert } from "../ui/Alert.tsx";
import { BrandLink } from "../ui/AuthLayout.tsx";
import { Button } from "../ui/Button.tsx";
import { cx } from "../ui/cx.ts";
import { PageSpinner } from "../ui/Spinner.tsx";
import { BulkBar } from "./BulkBar.tsx";
import { ConsentBanner } from "./ConsentBanner.tsx";
import {
  AddDialog,
  BulkTagsDialog,
  CollectionDialog,
  CollectionsDialog,
  ConfirmDialog,
  NewCollectionDialog,
  NoteDialog,
  SettingsDialog,
  TagsDialog,
} from "./dialogs.tsx";
import { applyQuery, platformsInUse, tagCounts, type Layout } from "./query.ts";
import { SaveCard, type SaveActions } from "./SaveCard.tsx";
import { useSearch } from "./search.ts";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";
import { useQuery } from "./useQuery.ts";

// The library (CLAUDE.md §6.6): everything the device holds, filtered and searched in memory.

const forget = () => undefined;

type DialogState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "settings" }
  | { kind: "tags"; save: LibrarySave }
  | { kind: "note"; save: LibrarySave }
  | { kind: "collections"; saves: LibrarySave[] }
  | { kind: "bulk-tags"; ids: string[] }
  | { kind: "new-collection" }
  | { kind: "collection"; collection: Collection }
  | { kind: "confirm"; title: string; body: string; action: string; onConfirm: () => void };

function useAppConfig(): RemoteConfig {
  const [config, setConfig] = useState<RemoteConfig>({});
  useEffect(() => watchAppConfig(setConfig), []);
  return config;
}

function useCollections(uid: string): Collection[] {
  const [collections, setCollections] = useState<Collection[]>([]);
  useEffect(() => watchCollections(uid, setCollections), [uid]);
  return collections;
}

/** "dark" or "light" as shown right now (the setting, or the OS when it's "system"). */
function useResolvedTheme(theme: string | undefined): "light" | "dark" {
  const [system, setSystem] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystem(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return theme === "dark" || theme === "light" ? theme : system ? "dark" : "light";
}

export function LibraryPage({ user }: { user: User }) {
  const uid = user.uid;
  const library = useLibrary(uid);
  const collections = useCollections(uid);
  const config = useAppConfig();
  const [settings, updateSettings] = useSettings(uid);
  const [query, setQuery] = useQuery();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [caughtUp, setCaughtUp] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const theme = useResolvedTheme(settings.theme);

  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  // Links shared on this device before signing in (kept by /save/ and /share/) are saved now.
  useEffect(() => {
    ensureProfile(user).catch(forget);
    savePending(uid).then(setCaughtUp, forget);
  }, [user, uid]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const search = useSearch(library.saves);
  const shown = useMemo(() => applyQuery(library.saves, query, search(query.q)), [library.saves, query, search]);
  const tags = useMemo(() => tagCounts(library.saves), [library.saves]);
  const platforms = useMemo(() => platformsInUse(library.saves), [library.saves]);
  const collectionNames = useMemo(() => new Map(collections.map((c) => [c.id, c.name])), [collections]);
  const counts = useMemo(
    () => ({
      all: library.saves.filter((s) => s.status === "active").length,
      favorites: library.saves.filter((s) => s.status === "active" && s.favorite).length,
      unavailable: library.saves.filter((s) => s.status === "active" && s.embedStatus === "unavailable").length,
      trash: library.saves.filter((s) => s.status === "trashed").length,
    }),
    [library.saves],
  );

  const previews = settings.previews ?? defaultPreviews();
  const layout: Layout = settings.view ?? "grid";
  const inTrash = query.view === "trash";

  // Selection follows what's shown; leaving select mode clears it.
  useEffect(() => {
    if (!selecting) setSelected(new Set());
  }, [selecting]);
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectedSaves = shown.filter((s) => selected.has(s.id));

  const fail = (e: unknown) => setToast(errorMessage(e));
  const actions: SaveActions = {
    favorite: (s) => setFavorite(uid, s.id, !s.favorite).catch(fail),
    tags: (s) => setDialog({ kind: "tags", save: s }),
    note: (s) => setDialog({ kind: "note", save: s }),
    collections: (s) => setDialog({ kind: "collections", saves: [s] }),
    copyLink: (s) => {
      navigator.clipboard?.writeText(s.url).then(() => setToast("Link copied"), () => setToast("Couldn't copy the link"));
    },
    trash: (s) => {
      trashSave(uid, s.id).catch(fail);
      setToast("Moved to the Trash");
    },
    restore: (s) => restoreSave(uid, s.id).catch(fail),
    deleteForever: (s) =>
      setDialog({
        kind: "confirm",
        title: "Delete forever?",
        body: "This removes the save from your library on every device. It can't be undone.",
        action: "Delete forever",
        onConfirm: () => deleteSave(uid, s.id).catch(fail),
      }),
    verdict: (s, status) => setEmbedStatus(uid, s.id, status).catch(forget),
  };

  const bulk = {
    favorite: () => selectedSaves.forEach((s) => setFavorite(uid, s.id, true).catch(fail)),
    trash: () => {
      selectedSaves.forEach((s) => trashSave(uid, s.id).catch(fail));
      setSelecting(false);
    },
    restore: () => {
      selectedSaves.forEach((s) => restoreSave(uid, s.id).catch(fail));
      setSelecting(false);
    },
    deleteForever: () =>
      setDialog({
        kind: "confirm",
        title: `Delete ${selectedSaves.length} saves forever?`,
        body: "This removes them from your library on every device. It can't be undone.",
        action: "Delete forever",
        onConfirm: () => {
          selectedSaves.forEach((s) => deleteSave(uid, s.id).catch(fail));
          setSelecting(false);
        },
      }),
  };

  // Desktop shortcuts: / search · n add · f favorite · e tags (the last two on the focused card).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || dialog.kind !== "none") return;
      if (target && (target.closest("input, textarea, select, [contenteditable]") || target.closest("dialog"))) return;
      const focusedId = target?.closest<HTMLElement>("[data-save-id]")?.dataset.saveId;
      const focused = focusedId ? library.saves.find((s) => s.id === focusedId) : undefined;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") setDialog({ kind: "add" });
      else if (e.key === "f" && focused && focused.status === "active") actions.favorite(focused);
      else if (e.key === "e" && focused && focused.status === "active") actions.tags(focused);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function leave() {
    await clearLocalData();
    await signOut();
  }

  const disabledPlatforms = config.disabledEmbeds ?? [];
  const sidebar = (
    <Sidebar
      query={query}
      onQuery={setQuery}
      counts={counts}
      collections={collections}
      tags={tags}
      onNewCollection={() => setDialog({ kind: "new-collection" })}
      onManageCollection={(collection) => setDialog({ kind: "collection", collection })}
    />
  );

  return (
    <div className={cx("min-h-dvh", selecting && "pb-24")}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-night/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <BrandLink />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline">
              <SyncStatus library={library} />
            </span>
            <Button size="sm" onClick={() => setDialog({ kind: "add" })}>
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "settings" })}>
              Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">{sidebar}</div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
            <SyncStatus library={library} />
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/15">
                Browse
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#0b1430]">{sidebar}</div>
            </details>
          </div>

          {config.maintenance && (
            <Alert tone="warning" className="mb-4" title="Maintenance in progress">
              Saving and syncing may pause for a short while. Nothing is lost.
            </Alert>
          )}
          {config.notice && (
            <Alert tone="info" className="mb-4">
              {config.notice}
            </Alert>
          )}
          {library.status === "paused" && (
            <Alert tone="warning" className="mb-4">
              Cloud sync is paused until tomorrow because the service reached its daily limit. Your saves are safe on this device.
            </Alert>
          )}
          {library.problem && (
            <Alert tone="error" className="mb-4">
              Syncing stopped: {errorMessage({ code: library.problem })}
            </Alert>
          )}
          {caughtUp > 0 && (
            <Alert tone="success" className="mb-4">
              {caughtUp === 1 ? "The link you shared before signing in is saved." : `The ${caughtUp} links you shared before signing in are saved.`}
            </Alert>
          )}
          {!settings.previews && previews === "ask" && counts.all > 0 && <ConsentBanner onChoose={(p) => updateSettings({ previews: p })} />}

          <TopBar
            query={query}
            onQuery={setQuery}
            platforms={platforms}
            layout={layout}
            onLayout={(view) => updateSettings({ view })}
            selecting={selecting}
            onSelecting={setSelecting}
            searchRef={searchRef}
            shown={shown.length}
          />

          <div className="mt-4">
            {!library.loaded ? (
              <PageSpinner label="Loading your saves…" />
            ) : shown.length === 0 ? (
              <Empty query={query} total={counts.all} onAdd={() => setDialog({ kind: "add" })} />
            ) : (
              <ul
                aria-label="Saves"
                className={layout === "grid" ? "columns-1 gap-4 sm:columns-2 xl:columns-3" : "space-y-2"}
              >
                {shown.map((save) => (
                  <SaveCard
                    key={save.id}
                    save={save}
                    layout={layout}
                    theme={theme}
                    previews={previews === "always" ? "always" : "click"}
                    disabledPlatforms={disabledPlatforms}
                    collectionNames={collectionNames}
                    actions={actions}
                    selecting={selecting}
                    selected={selected.has(save.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>

      {selecting && (
        <BulkBar
          count={selectedSaves.length}
          inTrash={inTrash}
          onFavorite={bulk.favorite}
          onTags={() => setDialog({ kind: "bulk-tags", ids: selectedSaves.map((s) => s.id) })}
          onCollections={() => setDialog({ kind: "collections", saves: selectedSaves })}
          onTrash={bulk.trash}
          onRestore={bulk.restore}
          onDeleteForever={bulk.deleteForever}
          onSelectAll={() => setSelected(new Set(shown.map((s) => s.id)))}
          onClear={() => setSelecting(false)}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-brand-ink px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-brand-ink">
          {toast}
        </div>
      )}

      {dialog.kind === "add" && <AddDialog uid={uid} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "settings" && (
        <SettingsDialog user={user} settings={settings} onUpdate={updateSettings} onSignOut={() => void leave()} onClose={() => setDialog({ kind: "none" })} />
      )}
      {dialog.kind === "tags" && <TagsDialog uid={uid} save={library.saves.find((s) => s.id === dialog.save.id) ?? dialog.save} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "note" && <NoteDialog uid={uid} save={library.saves.find((s) => s.id === dialog.save.id) ?? dialog.save} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "collections" && (
        <CollectionsDialog
          uid={uid}
          saves={dialog.saves.map((d) => library.saves.find((s) => s.id === d.id) ?? d)}
          collections={collections}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "bulk-tags" && <BulkTagsDialog uid={uid} ids={dialog.ids} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "new-collection" && <NewCollectionDialog uid={uid} order={collections.length} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "collection" && <CollectionDialog uid={uid} collection={dialog.collection} onClose={() => setDialog({ kind: "none" })} />}
      {dialog.kind === "confirm" && (
        <ConfirmDialog title={dialog.title} body={dialog.body} action={dialog.action} onConfirm={dialog.onConfirm} onClose={() => setDialog({ kind: "none" })} />
      )}
    </div>
  );
}

function Empty({ query, total, onAdd }: { query: { view: string; q: string; tag?: string; collection?: string; platform?: string }; total: number; onAdd: () => void }) {
  if (total === 0 && query.view === "all" && !query.q) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-white/15">
        <p className="text-lg font-semibold">Nothing saved yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-slate-600 dark:text-slate-300">
          Share a post from any app to this one, or paste its link here, and it shows up on all your devices.
        </p>
        <Button size="sm" className="mt-5" onClick={onAdd}>
          Save a link
        </Button>
      </div>
    );
  }
  const what = query.view === "trash" ? "The Trash is empty." : query.view === "favorites" ? "No favorites yet." : query.view === "unavailable" ? "No unavailable posts." : "Nothing matches.";
  return <p className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-600 dark:border-white/15 dark:text-slate-300">{what}</p>;
}

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { LIMITS, normalizeTags, type ParsedLink, type UserSettings } from "@postsaver/core";
import { addToCollection, cleanName, createCollection, deleteCollection, removeFromCollection, renameCollection, type Collection } from "../data/collections.ts";
import { addTags } from "../data/edits.ts";
import type { Previews, Theme } from "../data/settings.ts";
import { NoteEditor, TagEditor } from "../pages/save/QuickActions.tsx";
import { PasteForm } from "../pages/save/PasteForm.tsx";
import { SaveResult } from "../pages/save/SaveResult.tsx";
import { errorMessage } from "../pages/save/messages.ts";
import type { LibrarySave } from "../sync/library.ts";
import { Alert } from "../ui/Alert.tsx";
import { Button, ButtonLink } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { TextField } from "../ui/TextField.tsx";

const forget = () => undefined;

export function TagsDialog({ uid, save, onClose }: { uid: string; save: LibrarySave; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title="Tags">
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <TagEditor uid={uid} id={save.id} tags={save.tags} fail={(e) => setError(errorMessage(e))} />
    </Dialog>
  );
}

export function NoteDialog({ uid, save, onClose }: { uid: string; save: LibrarySave; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title="Note">
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <NoteEditor uid={uid} id={save.id} note={save.note ?? ""} fail={(e) => setError(errorMessage(e))} />
    </Dialog>
  );
}

/** Tags for several saves at once (added to what each already has). */
export function BulkTagsDialog({ uid, ids, onClose }: { uid: string; ids: string[]; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const tags = normalizeTags(draft.split(","));
    if (tags.length === 0) return;
    for (const id of ids) addTags(uid, id, tags).catch(forget);
    onClose();
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add tags to ${ids.length} saves`}
      footer={
        <Button size="sm" onClick={submit} disabled={!draft.trim()} className="px-5">
          Add tags
        </Button>
      }
    >
      <form onSubmit={submit}>
        <TextField label="Tags, separated by commas" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="recipes, weekend" autoFocus />
      </form>
    </Dialog>
  );
}

interface CollectionsDialogProps {
  uid: string;
  /** The saves to put in collections; with one, its memberships can also be removed. */
  saves: LibrarySave[];
  collections: Collection[];
  onClose: () => void;
}

/** Which collections a save is in; for several saves, which ones to add them to. */
export function CollectionsDialog({ uid, saves, collections, onClose }: CollectionsDialogProps) {
  const [name, setName] = useState("");
  // What was just ticked, shown at once; the library's copy catches up a moment later.
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const single = saves.length === 1 ? saves[0] : undefined;
  const inAll = (id: string) => chosen[id] ?? saves.every((s) => s.collectionIds.includes(id));

  function toggle(collectionId: string, on: boolean) {
    setChosen((prev) => ({ ...prev, [collectionId]: on }));
    for (const s of saves) {
      if (on && !s.collectionIds.includes(collectionId)) {
        if (s.collectionIds.length >= LIMITS.collectionIds) continue;
        addToCollection(uid, s.id, collectionId).catch(forget);
      } else if (!on && s.collectionIds.includes(collectionId)) removeFromCollection(uid, s.id, collectionId).catch(forget);
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) return;
    const { id } = createCollection(uid, clean, collections.length);
    toggle(id, true);
    setName("");
  }

  return (
    <Dialog open onClose={onClose} title={single ? "Collections" : `Add ${saves.length} saves to a collection`}>
      {collections.length > 0 ? (
        <ul className="space-y-1">
          {collections.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
                <input type="checkbox" checked={inAll(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="size-5 accent-brand-to" />
                <span className="text-sm">{c.emoji ? `${c.emoji} ${c.name}` : c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">No collections yet. Make the first one:</p>
      )}
      <form onSubmit={create} className="mt-4 flex items-end gap-2">
        <TextField label="New collection" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.collectionName} placeholder="e.g. Recipes" className="flex-1" />
        <Button variant="secondary" size="sm" type="submit" disabled={!name.trim()} className="mb-0.5 py-3">
          Create
        </Button>
      </form>
    </Dialog>
  );
}

export function NewCollectionDialog({ uid, order, onClose }: { uid: string; order: number; onClose: () => void }) {
  const [name, setName] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) return;
    createCollection(uid, clean, order);
    onClose();
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="New collection"
      footer={
        <Button size="sm" onClick={submit} disabled={!name.trim()} className="px-5">
          Create
        </Button>
      }
    >
      <form onSubmit={submit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.collectionName} placeholder="e.g. Recipes" autoFocus />
      </form>
    </Dialog>
  );
}

export function CollectionDialog({ uid, collection, onClose }: { uid: string; collection: Collection; onClose: () => void }) {
  const [name, setName] = useState(collection.name);
  const [confirm, setConfirm] = useState(false);
  function save(event: FormEvent) {
    event.preventDefault();
    const clean = cleanName(name);
    if (clean && clean !== collection.name) renameCollection(uid, collection.id, clean).catch(forget);
    onClose();
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Collection"
      footer={
        confirm ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button size="sm" className="bg-red-600 from-red-600 to-red-600 px-5" onClick={() => { deleteCollection(uid, collection.id).catch(forget); onClose(); }}>
              Delete collection
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(true)} className="text-red-700 dark:text-red-300">
              Delete…
            </Button>
            <Button size="sm" onClick={save} disabled={!name.trim()} className="px-5">
              Save
            </Button>
          </>
        )
      }
    >
      <form onSubmit={save}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.collectionName} autoFocus />
      </form>
      {confirm && (
        <Alert tone="warning" className="mt-4">
          The saves stay in your library; only the collection goes.
        </Alert>
      )}
    </Dialog>
  );
}

export function ConfirmDialog({ title, body, action, onConfirm, onClose }: { title: string; body: string; action: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="bg-red-600 from-red-600 to-red-600 px-5" onClick={() => { onConfirm(); onClose(); }}>
            {action}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>
    </Dialog>
  );
}

export function AddDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [link, setLink] = useState<ParsedLink | null>(null);
  return (
    <Dialog open onClose={onClose} title={link ? "Saved" : "Save a link"}>
      {link ? (
        <>
          <SaveResult key={link.canonicalUrl} uid={uid} link={link} source="paste" compact />
          <Button variant="link" className="mt-4 text-sm" onClick={() => setLink(null)}>
            Save another link
          </Button>
        </>
      ) : (
        <PasteForm onLink={setLink} autoFocus />
      )}
    </Dialog>
  );
}

interface SettingsDialogProps {
  user: User;
  settings: UserSettings;
  onUpdate: (patch: UserSettings) => void;
  onSignOut: () => void;
  onImport: () => void;
  onExport: () => void;
  onDeleteAccount: () => void;
  onClose: () => void;
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string, string?]>; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="space-y-1">
        {options.map(([v, text, hint]) => (
          <label key={v} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="mt-1 size-4 accent-brand-to" />
            <span className="text-sm">
              {text}
              {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsDialog({ user, settings, onUpdate, onSignOut, onImport, onExport, onDeleteAccount, onClose }: SettingsDialogProps) {
  const [busy, setBusy] = useState(false);
  useEffect(() => () => setBusy(false), []);
  return (
    <Dialog open onClose={onClose} title="Settings">
      <div className="space-y-6">
        <Choice<Theme>
          label="Theme"
          value={settings.theme ?? "system"}
          options={[["system", "Same as the device"], ["light", "Light"], ["dark", "Dark"]]}
          onChange={(theme) => onUpdate({ theme })}
        />
        <Choice<Previews>
          label="Previews"
          value={settings.previews ?? "ask"}
          options={[
            ["always", "Always show", "Previews load from the platforms, which may set cookies."],
            ["click", "Only when I tap", "Each preview loads after a tap."],
          ]}
          onChange={(previews) => onUpdate({ previews })}
        />
        <div>
          <p className="text-sm font-medium">Saving from this device</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Put the app in your phone's Share menu, or add a Save button to your browser.</p>
          <ButtonLink href="/setup/" variant="secondary" size="sm" className="mt-3">
            Set up saving
          </ButtonLink>
        </div>
        <div>
          <p className="text-sm font-medium">Your data</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bring in posts you saved elsewhere, or download everything you've saved here.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onImport}>
              Import…
            </Button>
            <Button variant="secondary" size="sm" onClick={onExport}>
              Export…
            </Button>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Account</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              variant="secondary"
              size="sm"
              busy={busy}
              onClick={() => {
                setBusy(true);
                onSignOut();
              }}
            >
              Sign out
            </Button>
            <Button variant="link" className="text-sm text-red-700 dark:text-red-300" onClick={onDeleteAccount}>
              Delete account…
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

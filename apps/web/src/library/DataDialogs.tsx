import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { site } from "@postsaver/config";
import { cancelDeletion, confirmOwner, deleteAccount, signInKind, type DeleteProgress } from "../account/delete.ts";
import { authErrorMessage } from "../auth/errors.ts";
import type { CategoryIndex } from "../data/categories.ts";
import type { Collection } from "../data/collections.ts";
import { errorCode } from "../data/firestore.ts";
import { buildExport, download, type ExportFormat } from "../export/build.ts";
import { planImport, type ImportPlan } from "../import/plan.ts";
import { readImportFile } from "../import/read.ts";
import { IMPORT_NAMES, ImportError } from "../import/types.ts";
import type { ImportControls } from "../import/useImport.ts";
import { errorMessage } from "../pages/save/messages.ts";
import type { LibrarySave } from "../sync/library.ts";
import { Alert } from "../ui/Alert.tsx";
import { Button } from "../ui/Button.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { PasswordField } from "../ui/TextField.tsx";

// Import, export and deleting the account (CLAUDE.md §6.1, §6.8): the dialogs behind
// Settings → "Your data", and the banner that shows an import's progress.

const n = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

// ---------- import ----------

function HowTo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-white/10">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <div className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </details>
  );
}

interface ImportDialogProps {
  saves: readonly LibrarySave[];
  collections: readonly Collection[];
  categories: CategoryIndex;
  controls: ImportControls;
  /** What the account last chose for posts unsaved on Instagram. */
  onUnsave: "remove" | "keep";
  onChooseUnsave: (choice: "remove" | "keep") => void;
  onClose: () => void;
}

type ImportPhase = { kind: "pick"; error?: string } | { kind: "reading"; name: string } | { kind: "ready"; name: string; plan: ImportPlan };

export function ImportDialog({ saves, collections, categories, controls, onUnsave, onChooseUnsave, onClose }: ImportDialogProps) {
  const [phase, setPhase] = useState<ImportPhase>({ kind: "pick" });
  const [unsave, setUnsave] = useState(onUnsave);
  const [starting, setStarting] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File) {
    setPhase({ kind: "reading", name: file.name });
    try {
      const parsed = await readImportFile(file);
      const plan = await planImport(parsed, saves, new Map(collections.map((c) => [c.id, c.name])), categories);
      setPhase({ kind: "ready", name: file.name, plan });
    } catch (error) {
      setPhase({ kind: "pick", error: error instanceof ImportError ? error.message : "That file couldn't be read. Is it the right one?" });
    }
  }

  async function start(plan: ImportPlan) {
    setStarting(true);
    const remove = plan.missing.length > 0 && unsave === "remove";
    if (plan.missing.length > 0 && unsave !== onUnsave) onChooseUnsave(unsave);
    try {
      await controls.start(plan, { trashMissing: remove });
      onClose();
    } catch {
      setStarting(false);
      setPhase({ kind: "pick", error: "This browser couldn't keep the import. Check that it isn't in private mode, then try again." });
    }
  }

  if (controls.view) {
    return (
      <Dialog open onClose={onClose} title="Import">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          An import is running already ({controls.view.cursor.toLocaleString()} of {controls.view.total.toLocaleString()}). You can start another when it's done.
        </p>
      </Dialog>
    );
  }

  if (phase.kind === "ready") {
    const { plan } = phase;
    const writes = plan.add.length + plan.update.length;
    const cap = controls.cap;
    const days = cap > 0 ? Math.ceil(writes / cap) : 0;
    const nothing = writes === 0 && plan.missing.length === 0;
    return (
      <Dialog
        open
        onClose={onClose}
        title="Import"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPhase({ kind: "pick" })}>
              Choose another file
            </Button>
            {!nothing && (
              <Button size="sm" busy={starting} onClick={() => void start(plan)}>
                {plan.add.length > 0 ? `Import ${n(plan.add.length, "post")}` : "Apply changes"}
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm">
          <span className="font-semibold">{phase.name}</span> is {IMPORT_NAMES[plan.type]} with {n(plan.add.length + plan.already, "post")}.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300" aria-label="What the import will do">
          <li>
            <span className="font-semibold text-brand-ink dark:text-white">{n(plan.add.length, "new post")}</span> will be added
          </li>
          {plan.already > 0 && (
            <li>
              {n(plan.already, "is", "are")} in your library already
              {plan.update.length > 0 && ` (${n(plan.update.length, "gets", "get")} new tags or collections)`}
            </li>
          )}
          {plan.invalid > 0 && <li>{n(plan.invalid, "entry", "entries")} had no usable link</li>}
          {plan.collections.length > 0 && <li>Collections: {plan.collections.join(", ")}</li>}
          {plan.categories.length > 0 && <li>New categories: {plan.categories.map((c) => c.name).join(", ")}</li>}
        </ul>
        {nothing && <p className="mt-3 text-sm font-medium">There's nothing new in this file.</p>}
        {days > 1 && (
          <Alert tone="info" className="mt-4">
            Imports add up to {cap.toLocaleString()} posts a day. This one takes about {days} days; it carries on by itself whenever you open your library on this device.
          </Alert>
        )}
        {plan.missing.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">
              {n(plan.missing.length, "post")} from an earlier Instagram import {plan.missing.length === 1 ? "isn't" : "aren't"} in this file: you unsaved {plan.missing.length === 1 ? "it" : "them"} on Instagram.
            </legend>
            <div className="mt-2 space-y-1">
              {(
                [
                  ["keep", "Keep them in my library"],
                  ["remove", "Move them to the Trash"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                  <input type="radio" name="unsave" checked={unsave === value} onChange={() => setUnsave(value)} className="size-4 accent-brand-to" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title="Import">
      <p className="text-sm text-slate-600 dark:text-slate-300">Bring in posts you saved elsewhere. The file is read on this device; only the links in it are saved to your library.</p>
      {phase.kind === "pick" && phase.error && (
        <Alert tone="error" className="mt-4">
          {phase.error}
        </Alert>
      )}
      <input
        ref={input}
        type="file"
        aria-label="File to import"
        accept=".zip,.json,.html,.htm,.csv,.tsv,.txt,application/zip,application/json,text/html,text/csv,text/plain"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      <Button className="mt-4" busy={phase.kind === "reading"} onClick={() => input.current?.click()}>
        {phase.kind === "reading" ? `Reading ${phase.name}…` : "Choose a file"}
      </Button>
      <div className="mt-5 space-y-2">
        <HowTo title="Instagram: your saved posts">
          <p>
            In the Instagram app: <b>Settings</b> → <b>Accounts Center</b> → <b>Your information and permissions</b> → <b>Download your information</b> → <b>Some of your information</b> → tick{" "}
            <b>Saved</b> → format <b>JSON</b> → <b>Create files</b>.
          </p>
          <p>Instagram emails you when the ZIP file is ready (minutes to a day). Download it and choose it here, as it is.</p>
          <p>Import a fresh file later and the app spots the posts you've unsaved on Instagram since.</p>
        </HowTo>
        <HowTo title="Browser bookmarks">
          <p>
            Chrome: <b>⋮</b> → <b>Bookmarks and lists</b> → <b>Bookmark manager</b> → <b>⋮</b> → <b>Export bookmarks</b>. Firefox, Safari and Edge have the same under Bookmarks. Folders
            become collections.
          </p>
        </HowTo>
        <HowTo title="Dewey, or any CSV file">
          <p>Export your bookmarks as CSV and choose the file. A column of links is enough; columns named tags, notes, folder and date are used too. A plain text file with one link per line works as well.</p>
        </HowTo>
        <HowTo title="An export of this app">
          <p>The JSON file from Settings → Export brings everything back, also into another account.</p>
        </HowTo>
      </div>
    </Dialog>
  );
}

const IMPORT_FROM: Record<string, string> = { bookmarks: "your bookmarks", csv: "the CSV file", dewey: "Dewey", instagram: "Instagram", backup: "the export" };

/** The progress of an import, above the library. */
export function ImportBanner({ controls }: { controls: ImportControls }) {
  const { view, finished } = controls;
  if (!view) {
    if (!finished) return null;
    return (
      <Alert tone="success" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {finished.added + finished.changed === 0
              ? "Import finished: there was nothing new to add."
              : `Import finished: ${n(finished.added, "post")} added${finished.changed > 0 ? `, ${finished.changed.toLocaleString()} updated` : ""}.`}
          </span>
          <Button variant="link" className="text-sm" onClick={controls.dismiss}>
            Dismiss
          </Button>
        </div>
      </Alert>
    );
  }
  const progress = `${view.cursor.toLocaleString()} of ${view.total.toLocaleString()}`;
  const text =
    view.status === "running"
      ? `Importing from ${IMPORT_FROM[view.type]}: ${progress}`
      : view.status === "paused"
        ? `Import paused at ${progress}.`
        : view.status === "waiting"
          ? `${progress} imported. Imports add up to ${view.cap.toLocaleString()} posts a day: the rest continues tomorrow, whenever you open your library on this device.`
          : `Imports are switched off for a moment; yours continues by itself (${progress} so far).`;
  return (
    <Alert tone="info" className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-import={view.status}>
        <span>{text}</span>
        <span className="flex gap-3">
          {view.status === "running" && (
            <Button variant="link" className="text-sm" onClick={controls.pause}>
              Pause
            </Button>
          )}
          {view.status === "paused" && (
            <Button variant="link" className="text-sm" onClick={controls.resume}>
              Resume
            </Button>
          )}
          <Button variant="link" className="text-sm" onClick={controls.cancel}>
            Cancel import
          </Button>
        </span>
      </div>
      <progress value={view.cursor} max={view.total} aria-label="Import progress" className="mt-2 block h-1.5 w-full overflow-hidden rounded-full accent-brand-to" />
    </Alert>
  );
}

// ---------- export ----------

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "json", label: "Everything (JSON)", hint: "All saves with their categories, tags, notes, collections and dates. This app can import it again." },
  { format: "csv", label: "Spreadsheet (CSV)", hint: "One row per save, for Excel, Numbers or Google Sheets." },
  { format: "html", label: "Bookmarks (HTML)", hint: "For any browser or bookmarking service. Collections become folders." },
];

export function ExportDialog({ saves, collections, categories, synced, onClose }: { saves: readonly LibrarySave[]; collections: readonly Collection[]; categories: CategoryIndex; synced: boolean; onClose: () => void }) {
  const active = saves.filter((s) => s.status === "active").length;
  const trashed = saves.length - active;
  return (
    <Dialog open onClose={onClose} title="Export">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Download {n(active, "save")} as a file. The file is made on this device.
        {trashed > 0 && ` The ${n(trashed, "save")} in the Trash ${trashed === 1 ? "is" : "are"} only in the JSON file.`}
      </p>
      {!synced && (
        <Alert tone="warning" className="mt-4">
          Your library is still syncing. The file will hold what's on this device right now.
        </Alert>
      )}
      <ul className="mt-4 space-y-2">
        {FORMATS.map(({ format, label, hint }) => (
          <li key={format} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-white/10">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
            </span>
            <Button variant="secondary" size="sm" className="shrink-0" aria-label={`Download ${label}`} onClick={() => download(buildExport(format, saves, collections, categories, `${site.brand.name} saves`))}>
              Download
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ---------- delete account ----------

const STAGES: Record<DeleteProgress["stage"], string> = {
  saves: "Deleting your saves…",
  collections: "Deleting your collections…",
  imports: "Deleting your import history…",
  account: "Deleting your account…",
};

function deleteError(error: unknown): string {
  const code = errorCode(error) ?? "";
  if (code === "resource-exhausted") return "The service reached its daily limit, so the deletion is paused. Open the app tomorrow and it carries on from here.";
  if (code === "auth/requires-recent-login") return "That took longer than your sign-in allows. Sign in again, and delete the account once more to finish.";
  if (code.startsWith("auth/")) return authErrorMessage(error) || "That didn't work. Please try again.";
  return errorMessage(error);
}

interface DeleteAccountDialogProps {
  user: User;
  saveCount: number;
  /** A deletion was started earlier and didn't finish. */
  resuming: boolean;
  onExport: () => void;
  onClose: () => void;
}

export function DeleteAccountDialog({ user, saveCount, resuming, onExport, onClose }: DeleteAccountDialogProps) {
  const kind = signInKind(user);
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const [progress, setProgress] = useState<DeleteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = progress !== null;

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!sure || working) return;
    setError(null);
    try {
      await confirmOwner(user, password);
    } catch (e) {
      const code = errorCode(e);
      // A closed Google window isn't an error worth a message.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(deleteError(e));
      return;
    }
    setProgress({ stage: "saves", removed: 0 });
    try {
      await deleteAccount(user, setProgress);
      location.replace("/login/?deleted=1");
    } catch (e) {
      setProgress(null);
      setError(deleteError(e));
    }
  }

  return (
    // While it runs, the dialog stays: closing it wouldn't stop the deletion.
    <Dialog open onClose={working ? () => undefined : onClose} title={resuming ? "Finish deleting your account" : "Delete your account"}>
      {working ? (
        <p role="status" className="text-sm font-medium">
          {STAGES[progress.stage]} {progress.removed > 0 && `${progress.removed.toLocaleString()} removed.`} Keep this page open.
        </p>
      ) : (
        <form onSubmit={(event) => void run(event)} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This deletes your account ({user.email}) with {saveCount > 0 ? `all ${n(saveCount, "save")}, ` : ""}your collections and settings, on every device.{" "}
            <strong className="font-semibold text-brand-ink dark:text-white">It can't be undone.</strong>
          </p>
          {!resuming && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Want a copy first?{" "}
              <Button variant="link" className="text-sm" onClick={onExport}>
                Export your saves
              </Button>
            </p>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          {kind === "password" ? (
            <PasswordField label="Your password, to confirm it's you" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Google will ask you to confirm it's you.</p>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 size-4 accent-red-600" />I understand that my saves can't be brought back.
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {resuming ? "Not now" : "Cancel"}
            </Button>
            <Button type="submit" size="sm" disabled={!sure} className="bg-red-600 from-red-600 to-red-600 px-5">
              Delete my account
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** Shown when the account was marked for deletion and the job didn't finish. */
export function DeletionPending({ uid, onContinue }: { uid: string; onContinue: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <Alert tone="warning" className="mb-4" title="This account is being deleted">
      <p>The deletion was started and didn't finish. Some of your saves may be gone already.</p>
      {failed && <p className="mt-1">That didn't work. Check your connection and try again.</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button size="sm" onClick={onContinue}>
          Finish deleting
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void cancelDeletion(uid).catch(() => setFailed(true))}>
          Keep my account
        </Button>
      </div>
    </Alert>
  );
}

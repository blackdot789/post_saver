import { useId, useState, type FormEvent } from "react";
import { LIMITS, normalizeTags } from "@postsaver/core";
import { addTags, removeTag, setNote } from "../../data/edits.ts";
import { useLiveSave } from "../../capture/useSave.ts";
import { errorMessage } from "./messages.ts";
import { Alert } from "../../ui/Alert.tsx";
import { Button } from "../../ui/Button.tsx";
import { CloseIcon } from "../../ui/icons.tsx";
import { TextArea } from "../../ui/TextField.tsx";

// Edits go to the device cache at once and sync like the save itself, so nothing here waits on
// the network; the promises only settle when the server confirms (or refuses).

function TagEditor({ uid, id, tags, fail }: { uid: string; id: string; tags: string[]; fail: (e: unknown) => void }) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const room = LIMITS.tags - tags.length;

  function add(event: FormEvent) {
    event.preventDefault();
    const fresh = normalizeTags(draft.split(",")).filter((t) => !tags.includes(t)).slice(0, room);
    setDraft("");
    if (fresh.length) addTags(uid, id, fresh).catch(fail);
  }

  return (
    <form onSubmit={add}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        Tags
      </label>
      {tags.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tags on this post">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-from/10 py-1 pr-1 pl-3 text-sm text-brand-ink dark:bg-brand-from/20 dark:text-slate-100"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(uid, id, tag).catch(fail)}
                className="grid size-6 place-items-center rounded-full text-slate-500 hover:bg-black/5 hover:text-brand-ink dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={room <= 0}
          placeholder={room > 0 ? "Add a tag, e.g. recipes" : `Up to ${LIMITS.tags} tags`}
          autoComplete="off"
          enterKeyHint="done"
          className="block min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base placeholder:text-slate-400 focus:border-brand-from focus:outline-3 focus:outline-brand-from/25 disabled:opacity-55 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-slate-500"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim() || room <= 0} className="px-4">
          Add
        </Button>
      </div>
    </form>
  );
}

function NoteEditor({ uid, id, note, fail }: { uid: string; id: string; note: string; fail: (e: unknown) => void }) {
  // null while not editing, so a note changed on another device shows up here.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft ?? note;
  const changed = draft !== null && draft.trim() !== note;

  function save() {
    setNote(uid, id, value).catch(fail);
    setDraft(null);
    setSaved(true);
  }

  return (
    <div>
      <TextArea
        label="Note"
        rows={3}
        maxLength={LIMITS.note}
        placeholder="Why you saved it, what to try…"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={save} disabled={!changed}>
          Save note
        </Button>
        {saved && (
          <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
            Note saved
          </span>
        )}
      </div>
    </div>
  );
}

/** Tags and a note, right after saving. Collections join here with the library (step 7). */
export function QuickActions({ uid, id }: { uid: string; id: string }) {
  const save = useLiveSave(uid, id);
  const [error, setError] = useState<string | null>(null);
  if (!save) return null;
  const fail = (e: unknown) => setError(errorMessage(e));
  return (
    <div className="mt-6 space-y-5 border-t border-slate-200 pt-5 dark:border-white/10">
      {error && <Alert tone="error">{error}</Alert>}
      <TagEditor uid={uid} id={id} tags={save.tags} fail={fail} />
      <NoteEditor uid={uid} id={id} note={save.note} fail={fail} />
    </div>
  );
}

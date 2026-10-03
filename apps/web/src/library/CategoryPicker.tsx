import { useState, type FormEvent } from "react";
import { LIMITS, cleanCategoryName } from "@postsaver/core";
import { CATEGORY_SYMBOLS, MAX_OWN_CATEGORIES, createCategory, deleteCategory, findCategory, updateCategory, type Category, type CategoryIndex } from "../data/categories.ts";
import { Button } from "../ui/Button.tsx";
import { cx } from "../ui/cx.ts";
import { TextField } from "../ui/TextField.tsx";

// Choosing what kind of thing a save is (CLAUDE.md §6.1 "As built: categories"), and making
// categories of one's own: a name and a symbol. Used right after saving and in the library.

const forget = () => undefined;

const CHIP = "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sm";
const chip = (on: boolean) => cx(CHIP, on ? "bg-brand-to text-white" : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15");

interface CategoryFormProps {
  uid: string;
  categories: CategoryIndex;
  /** The category being changed; none when making a new one. */
  editing?: Category;
  /** Called with the new (or existing, or changed) category's id. */
  onDone: (id: string) => void;
  onCancel: () => void;
  /** Called once the category being changed has been deleted. */
  onDeleted?: (id: string) => void;
}

/** A category's name and symbol: for a new one, or to change (or delete) one of the owner's. */
export function CategoryForm({ uid, categories, editing, onDone, onCancel, onDeleted }: CategoryFormProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [symbol, setSymbol] = useState(editing?.symbol ?? CATEGORY_SYMBOLS[0]!);
  const [confirm, setConfirm] = useState(false);
  const clean = cleanCategoryName(name);
  // A name that's taken: by the category being edited is fine, by another one it's that one.
  const taken = clean ? findCategory(clean, categories) : undefined;
  const clash = taken && taken.id !== editing?.id ? taken : undefined;
  const own = [...categories.values()].filter((c) => c.own).length;
  const symbols = CATEGORY_SYMBOLS.includes(symbol) ? CATEGORY_SYMBOLS : [symbol, ...CATEGORY_SYMBOLS];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!clean) return;
    if (editing) {
      if (clash) return;
      if (clean !== editing.name || symbol !== editing.symbol) updateCategory(uid, editing.id, { name: clean, symbol }).catch(forget);
      return onDone(editing.id);
    }
    // The name of a category that exists picks that one, instead of making a twin.
    if (clash) return onDone(clash.id);
    const { id, done } = createCategory(uid, clean, symbol, own);
    done.catch(forget);
    onDone(id);
  }

  if (editing && confirm) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete {editing.symbol} {editing.name}? What's in it stays in your library, without a category.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
          <Button
            size="sm"
            className="bg-red-600 from-red-600 to-red-600 px-5"
            onClick={() => {
              deleteCategory(uid, editing.id).catch(forget);
              onDeleted?.(editing.id);
            }}
          >
            Delete category
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.categoryName} placeholder="e.g. Recipes" autoComplete="off" autoFocus />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Symbol</legend>
        <div role="radiogroup" aria-label="Symbol" className="grid grid-cols-8 gap-1">
          {symbols.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={symbol === s}
              aria-label={s}
              onClick={() => setSymbol(s)}
              className={cx(
                "grid aspect-square place-items-center rounded-lg text-xl leading-none",
                symbol === s ? "bg-brand-from/15 ring-2 ring-brand-from dark:bg-brand-from/30" : "hover:bg-slate-100 dark:hover:bg-white/10",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>
      {clash && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {editing ? `There's already a category called ${clash.name}.` : `${clash.symbol} ${clash.name} exists already: it will be used.`}
        </p>
      )}
      {!editing && own >= MAX_OWN_CATEGORIES && !clash && <p className="text-sm text-slate-600 dark:text-slate-300">That's the most categories an account can have ({MAX_OWN_CATEGORIES}).</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="submit" disabled={!clean || (editing ? !!clash : own >= MAX_OWN_CATEGORIES && !clash)} className="px-5">
          {editing ? "Save" : clash ? `Use ${clash.name}` : "Create category"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {editing && (
          <Button variant="link" className="ml-auto text-sm text-red-700 dark:text-red-300" onClick={() => setConfirm(true)}>
            Delete…
          </Button>
        )}
      </div>
    </form>
  );
}

interface CategoryPickerProps {
  uid: string;
  categories: CategoryIndex;
  /** The chosen category's id, if any. */
  value: string | undefined;
  /** Called with a category's id, or null for none. */
  onChoose: (id: string | null) => void;
  /** Also lets the owner's own categories be renamed, given another symbol, or deleted. */
  manage?: boolean;
}

/** One chip per category, "None", and "New"; with `manage`, the owner's own can be edited too. */
export function CategoryPicker({ uid, categories, value, onChoose, manage = false }: CategoryPickerProps) {
  const [form, setForm] = useState<{ editing?: Category } | null>(null);
  const chosen = value && categories.has(value) ? value : undefined;
  const own = [...categories.values()].filter((c) => c.own);

  if (form) {
    return (
      <CategoryForm
        uid={uid}
        categories={categories}
        editing={form.editing}
        onDone={(id) => {
          if (!form.editing) onChoose(id);
          setForm(null);
        }}
        onCancel={() => setForm(null)}
        onDeleted={(id) => {
          if (chosen === id) onChoose(null);
          setForm(null);
        }}
      />
    );
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
        <li>
          <button type="button" aria-pressed={!chosen} onClick={() => onChoose(null)} className={chip(!chosen)}>
            None
          </button>
        </li>
        {[...categories.values()].map((c) => (
          <li key={c.id} className="max-w-full">
            <button type="button" aria-pressed={chosen === c.id} onClick={() => onChoose(c.id)} className={chip(chosen === c.id)}>
              <span aria-hidden="true">{c.symbol}</span>
              <span className="truncate">{c.name}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setForm({})} className={cx(CHIP, "border border-dashed border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10")}>
            <span aria-hidden="true">+</span> New
          </button>
        </li>
      </ul>
      {manage && own.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Your categories</h3>
          <ul className="mt-1.5 space-y-0.5">
            {own.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span aria-hidden="true">{c.symbol}</span>
                  <span className="truncate">{c.name}</span>
                </span>
                <Button variant="link" className="shrink-0 text-sm" aria-label={`Edit ${c.name}`} onClick={() => setForm({ editing: c })}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

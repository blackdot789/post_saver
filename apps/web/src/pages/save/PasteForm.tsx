import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { LIMITS } from "@postsaver/core";
import { readPasted, type Item } from "../../capture/item.ts";
import { Alert } from "../../ui/Alert.tsx";
import { Button } from "../../ui/Button.tsx";
import { TextArea } from "../../ui/TextField.tsx";

/**
 * One thing to save, typed or pasted: a post's link, or any text. A link by itself saves the
 * post; words save as a text; words with a link in them ask which of the two is meant.
 */
export function PasteForm({ onItem, autoFocus, initial = "" }: { onItem: (item: Item) => void; autoFocus?: boolean; initial?: string }) {
  const [value, setValue] = useState(initial);
  const pasted = useMemo(() => readPasted(value), [value]);
  const tooLong = value.trim().length > LIMITS.text;
  const mixed = pasted.link !== null && !pasted.onlyLink;

  function saveLink() {
    if (!pasted.link) return;
    setValue("");
    onItem({ link: pasted.link });
  }

  function saveText() {
    if (!pasted.text || tooLong) return;
    setValue("");
    onItem({ text: pasted.text });
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pasted.link) saveLink();
    else saveText();
  }

  // Enter saves a lone link, as it did when this was a one-line box; in a text it's a new line.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (event.metaKey || event.ctrlKey || pasted.onlyLink) submit(event);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextArea
        label="Link or text"
        name="item"
        rows={3}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Paste a post's link, or any text"
        hint="Text you save here can be copied on your other devices."
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {tooLong && !pasted.onlyLink && (
        <Alert tone="error">
          A text can be up to {LIMITS.text.toLocaleString()} characters. This one has {value.trim().length.toLocaleString()}.
        </Alert>
      )}
      {mixed ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit">Save the link</Button>
          <Button variant="secondary" onClick={saveText} disabled={tooLong}>
            Save as text
          </Button>
        </div>
      ) : (
        <Button type="submit" disabled={pasted.link ? false : !pasted.text || tooLong}>
          {pasted.text && !pasted.link ? "Save text" : "Save"}
        </Button>
      )}
    </form>
  );
}

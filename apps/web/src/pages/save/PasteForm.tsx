import { useState, type FormEvent } from "react";
import { findUrls, parse, type ParsedLink } from "@postsaver/core";
import { Alert } from "../../ui/Alert.tsx";
import { Button } from "../../ui/Button.tsx";
import { TextField } from "../../ui/TextField.tsx";

/** One link to save, typed or pasted (text around the link is fine). */
export function PasteForm({ onLink, autoFocus }: { onLink: (link: ParsedLink) => void; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const raw = findUrls(value, { limit: 1, lone: true })[0];
    const link = raw ? parse(raw) : null;
    if (!link) {
      setError("That doesn't look like a link. Copy the post's link from the app (Share → Copy link) and paste it here.");
      return;
    }
    setError(null);
    setValue("");
    onLink(link);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label="Link to a post"
        name="link"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={!value.trim()}>
        Save
      </Button>
    </form>
  );
}

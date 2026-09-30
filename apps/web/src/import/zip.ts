import { Unzip, UnzipInflate } from "fflate";

/** No export file worth reading is bigger than this once unpacked. */
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;

/**
 * Reads the wanted files out of a ZIP, as text, without unpacking the rest: the archive is
 * streamed through, so an export with gigabytes of photos doesn't have to fit in memory.
 */
export async function readZip(file: Blob, want: (path: string) => boolean): Promise<Map<string, string>> {
  const found = new Map<string, Uint8Array[]>();
  const unzip = new Unzip((entry) => {
    if (!want(entry.name) || (entry.originalSize ?? 0) > MAX_ENTRY_BYTES) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    found.set(entry.name, chunks);
    entry.ondata = (error, chunk) => {
      if (error) {
        found.delete(entry.name);
        return;
      }
      size += chunk.length;
      if (size > MAX_ENTRY_BYTES) {
        found.delete(entry.name);
        entry.terminate();
      } else chunks.push(chunk);
    };
    entry.start();
  });
  unzip.register(UnzipInflate);

  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    unzip.push(value);
  }
  unzip.push(new Uint8Array(0), true);

  const decoder = new TextDecoder();
  const out = new Map<string, string>();
  for (const [path, chunks] of found) {
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    out.set(path, decoder.decode(bytes));
  }
  return out;
}

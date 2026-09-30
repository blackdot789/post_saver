import { isBackup, parseBackup } from "./backup.ts";
import { isBookmarksFile, parseBookmarks } from "./bookmarks.ts";
import { parseCsvFile } from "./csv.ts";
import { isInstagramJson, isSavedFile, parseInstagramFiles } from "./instagram.ts";
import { ImportError, type ParsedFile } from "./types.ts";
import { readZip } from "./zip.ts";

// Works out what kind of file was picked and reads the links in it. Nothing leaves the device:
// the file is read here, in the browser.

/** A ZIP can be an Instagram export with photos in it; other files are just text. */
const MAX_ZIP_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_TEXT_BYTES = 30 * 1024 * 1024;

async function isZip(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05);
}

export async function readImportFile(file: File, now = Date.now()): Promise<ParsedFile> {
  if (file.size === 0) throw new ImportError("That file is empty.");

  if (await isZip(file)) {
    if (file.size > MAX_ZIP_BYTES) throw new ImportError("That file is too big to read here. In Instagram, ask for only your saved posts, then try again.");
    let files: Map<string, string>;
    try {
      files = await readZip(file, isSavedFile);
    } catch {
      throw new ImportError("That ZIP file couldn't be read. Download it again and pick the new file.");
    }
    if (files.size === 0) {
      throw new ImportError("There are no saved posts in that ZIP file. In Instagram's download, tick “Saved” (under “Your Instagram activity”), then try again.");
    }
    return parseInstagramFiles(files, now);
  }

  if (file.size > MAX_TEXT_BYTES) throw new ImportError("That file is too big. Files up to 30 MB can be imported.");
  const content = await file.text();
  const start = content.trimStart().slice(0, 1);

  if (start === "{" || start === "[") {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new ImportError("That file isn't valid JSON, so it can't be read.");
    }
    if (isBackup(data)) return parseBackup(data, now);
    if (isInstagramJson(data)) return parseInstagramFiles(new Map([[file.name, content]]), now);
    throw new ImportError("That JSON file isn't one this app knows: an Instagram export (saved_posts.json) or this app's own export.");
  }
  if (isBookmarksFile(content)) return parseBookmarks(content, now);
  // Instagram's export in its HTML form, picked directly.
  if (/saved_(posts|collections)\.html?$/i.test(file.name)) return parseInstagramFiles(new Map([[file.name, content]]), now);
  return parseCsvFile(content, now);
}

/**
 * Fails if the domain or brand name is hardcoded anywhere except site.config.ts (and brand/ assets).
 * This keeps a future domain/brand change to a one-file edit. Run: `pnpm check:domains`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { forbiddenLiterals } from "@postsaver/config";

const root = resolve(import.meta.dirname, "..");

const ALLOWED = [/^site\.config\.ts$/, /^brand\//, /^pnpm-lock\.yaml$/];
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|zip|pdf)$/i;

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f && !BINARY.test(f) && !ALLOWED.some((re) => re.test(f)));

const needles = forbiddenLiterals().map((s) => s.toLowerCase());
const problems: string[] = [];

for (const file of files) {
  let text: string;
  try {
    text = readFileSync(resolve(root, file), "utf8");
  } catch {
    continue; // deleted but still in the index
  }
  text.split("\n").forEach((line, i) => {
    const lower = line.toLowerCase();
    for (const needle of needles) {
      if (lower.includes(needle)) problems.push(`${file}:${i + 1}  contains "${needle}"`);
    }
  });
}

if (problems.length) {
  console.error("Hardcoded domain/brand found. Read it from site.config.ts instead:\n");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`check:domains OK (${files.length} files scanned)`);

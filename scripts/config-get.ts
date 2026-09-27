/**
 * Prints one value from the site config, for shell scripts and CI workflows.
 *   pnpm exec tsx scripts/config-get.ts hosts.embed        → embed.example.com
 *   pnpm exec tsx scripts/config-get.ts github.repos.embed → repo name
 */
import { site, hosts, origins } from "@postsaver/config";

const path = process.argv[2];
if (!path) {
  console.error("Usage: config-get <dotted.path>");
  process.exit(2);
}

const value = path
  .split(".")
  .reduce<unknown>((obj, key) => (obj as Record<string, unknown> | undefined)?.[key], { ...site, hosts, origins });

if (value === undefined) {
  console.error(`No config value at "${path}"`);
  process.exit(1);
}
process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));

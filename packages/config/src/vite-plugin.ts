import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { site } from "./index.ts";
import { applyHtmlTokens } from "./html.ts";

export interface SiteConfigPluginOptions {
  /** CSP injected as a <meta> tag in production builds (the dev server needs inline scripts). */
  csp?: () => string;
  /** Where to write the brand color CSS variables (generated, git-ignored). */
  brandCssPath?: string;
  /** Extra files emitted into the build output, e.g. robots.txt, manifest, CNAME. */
  files?: () => Record<string, string>;
  /** Builds /sw.js from a template once every other file is written (see `ServiceWorkerOptions`). */
  serviceWorker?: ServiceWorkerOptions;
}

export interface ServiceWorkerOptions {
  /** The template, with the placeholders __VERSION__, __FILES__ and __PAGES__. */
  template: string;
  /** The pages that open offline, as paths ending in "/" (each is `<path>index.html` in the build). */
  pages: readonly string[];
  /** Which other built files are kept for offline use, by their path from the site root. */
  keep: (path: string) => boolean;
}

/**
 * Makes an app's HTML, CSS and static files follow site.config.ts:
 * replaces %TOKENS% in HTML, writes brand CSS variables, injects CSP, emits config-driven files.
 */
export function siteConfigPlugin(options: SiteConfigPluginOptions = {}): Plugin {
  let outDir = "";
  let building = false;
  return {
    name: "post-saver-site-config",
    configResolved(config) {
      if (options.brandCssPath) writeBrandCss(options.brandCssPath);
      outDir = resolve(config.root, config.build.outDir);
      building = config.command === "build";
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        let out = applyHtmlTokens(html);
        if (options.csp && !ctx.server) {
          out = out.replace(
            "<head>",
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${options.csp()}" />`,
          );
        }
        return out;
      },
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(options.files?.() ?? {})) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
    // After everything (pages, hashed assets, the public folder) is on disk.
    closeBundle() {
      if (building && options.serviceWorker && existsSync(outDir)) writeFileSync(join(outDir, "sw.js"), buildServiceWorker(outDir, options.serviceWorker));
    },
  };
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path, root) : [`/${relative(root, path).split(sep).join("/")}`];
  });
}

/**
 * The service worker for a finished build: the template with the list of files to keep for
 * offline use, and a version that changes whenever any of them does.
 */
export function buildServiceWorker(outDir: string, { template, pages, keep }: ServiceWorkerOptions): string {
  const built = listFiles(outDir);
  for (const page of pages) {
    if (!built.includes(`${page}index.html`)) throw new Error(`Service worker: the page ${page} isn't in the build`);
  }
  const files = [...pages, ...built.filter((path) => path !== "/sw.js" && !path.endsWith("/index.html") && keep(path))].sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(join(outDir, file.endsWith("/") ? `${file}index.html` : file)));
  }
  const filled = readFileSync(template, "utf8")
    .replace('"__VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
    .replace("__FILES__", JSON.stringify(files))
    .replace("__PAGES__", JSON.stringify([...pages]));
  if (/__(VERSION|FILES|PAGES)__/.test(filled.replace(/^\/\/.*$/gm, ""))) throw new Error("Service worker: a placeholder is missing from the template");
  return filled;
}

function writeBrandCss(path: string) {
  const { from, to, ink } = site.brand.colors;
  const css = `/* Generated from site.config.ts by the site config plugin. Do not edit. */
:root {
  --brand-from: ${from};
  --brand-to: ${to};
  --brand-ink: ${ink};
}
`;
  // Only write on change, so the dev server doesn't reload in a loop.
  if (existsSync(path) && readFileSync(path, "utf8") === css) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, css);
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
}

/**
 * Makes an app's HTML, CSS and static files follow site.config.ts:
 * replaces %TOKENS% in HTML, writes brand CSS variables, injects CSP, emits config-driven files.
 */
export function siteConfigPlugin(options: SiteConfigPluginOptions = {}): Plugin {
  return {
    name: "post-saver-site-config",
    configResolved() {
      if (options.brandCssPath) writeBrandCss(options.brandCssPath);
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
  };
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

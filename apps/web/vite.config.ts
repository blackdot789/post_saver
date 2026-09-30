import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { site, origins } from "@postsaver/config";
import { mainSiteCsp } from "@postsaver/config/html";
import { siteConfigPlugin } from "@postsaver/config/vite-plugin";

const here = (p: string) => resolve(import.meta.dirname, p);
const e2eEnv = (mode: string) => loadEnv(mode, import.meta.dirname, "VITE_");

/** The pages that open without a connection (the landing page is left to the network). */
const APP_PAGES = ["/app/", "/login/", "/save/", "/share/", "/setup/"];

// `--mode e2e` builds against the local Firebase emulators (see .env.e2e and tests/e2e).
export default defineConfig(({ mode }) => ({
  plugins: [
    siteConfigPlugin({
      csp: () =>
        mainSiteCsp({
          emulators: mode === "e2e",
          ...(mode === "e2e" ? { embedOrigin: e2eEnv(mode).VITE_EMBED_ORIGIN, apiBaseUrl: e2eEnv(mode).VITE_API_BASE_URL } : {}),
        }),
      brandCssPath: here("src/generated/brand.css"),
      files: () => ({
        "robots.txt": `User-agent: *\nAllow: /\n${APP_PAGES.map((p) => `Disallow: ${p}\n`).join("")}\nSitemap: ${origins.app}/sitemap.xml\n`,
        "sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origins.app}/</loc></url>\n</urlset>\n`,
        "manifest.webmanifest": JSON.stringify(
          {
            name: site.brand.name,
            short_name: site.brand.shortName,
            description: site.brand.description,
            // A fixed id keeps installs the same app even if start_url changes later.
            id: "/",
            start_url: "/app/",
            scope: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: site.brand.colors.to,
            icons: [
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
              { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
            // Android: the installed app appears in the Share menu and receives the shared link
            // (CLAUDE.md §6.1). Apps put the link in `text` or `url`.
            share_target: {
              action: "/share/",
              method: "GET",
              params: { title: "title", text: "text", url: "url" },
            },
            // A long press on the app's icon.
            shortcuts: [
              { name: "Save a link", url: "/save/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
              { name: "Library", url: "/app/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
            ],
          },
          null,
          2,
        ),
      }),
      serviceWorker: {
        template: here("sw.template.js"),
        pages: APP_PAGES,
        // Scripts, styles and fonts (hashed names), icons and the manifest.
        keep: (path) => path.startsWith("/assets/") || path.startsWith("/icons/") || path === "/favicon.svg" || path === "/manifest.webmanifest",
      },
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        index: here("index.html"),
        notFound: here("404.html"),
        login: here("login/index.html"),
        app: here("app/index.html"),
        save: here("save/index.html"),
        share: here("share/index.html"),
        setup: here("setup/index.html"),
      },
    },
  },
}));

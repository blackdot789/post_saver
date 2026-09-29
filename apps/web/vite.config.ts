import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { site, origins } from "@postsaver/config";
import { mainSiteCsp } from "@postsaver/config/html";
import { siteConfigPlugin } from "@postsaver/config/vite-plugin";

const here = (p: string) => resolve(import.meta.dirname, p);

// `--mode e2e` builds against the local Firebase emulators (see .env.e2e and tests/e2e).
export default defineConfig(({ mode }) => ({
  plugins: [
    siteConfigPlugin({
      csp: () => mainSiteCsp({ emulators: mode === "e2e" }),
      brandCssPath: here("src/generated/brand.css"),
      files: () => ({
        "robots.txt": `User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /login/\nDisallow: /save/\nDisallow: /share/\n\nSitemap: ${origins.app}/sitemap.xml\n`,
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
          },
          null,
          2,
        ),
      }),
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
      },
    },
  },
}));

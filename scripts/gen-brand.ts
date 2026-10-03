/**
 * Renders the icons and images the site needs, for every brand in site.config.ts:
 * brand/<key>/{mark.svg, mark-small.svg, logo-full.png} → brand/<key>/public/.
 * The web app serves the active brand's `public` folder (apps/web/vite.config.ts), so switching
 * brands needs no run of this. Run it after changing a logo file: `pnpm brand` (outputs are committed).
 */
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { brands } from "@postsaver/config";

const root = resolve(import.meta.dirname, "..");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Renders an SVG centered on a square canvas, occupying `scale` of the side. */
async function squareIcon(svg: string, size: number, scale: number, background = WHITE) {
  const inner = Math.round(size * scale);
  const mark = await sharp(svg, { density: 600 })
    .resize(inner, inner, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png();
}

async function generate(key: string) {
  const source = (f: string) => resolve(root, "brand", key, f);
  const out = (f: string) => resolve(root, "brand", key, "public", f);
  await mkdir(out("icons"), { recursive: true });

  // Browser tab, and anywhere the mark is drawn small: the simplified mark reads best there.
  await copyFile(source("mark-small.svg"), out("favicon.svg"));
  await (await squareIcon(source("mark-small.svg"), 32, 0.94, CLEAR)).toFile(out("icons/favicon-32.png"));

  // App icons: the full mark on white.
  await (await squareIcon(source("mark.svg"), 180, 0.72)).toFile(out("icons/apple-touch-icon.png"));
  await (await squareIcon(source("mark.svg"), 192, 0.72)).toFile(out("icons/icon-192.png"));
  await (await squareIcon(source("mark.svg"), 512, 0.72)).toFile(out("icons/icon-512.png"));
  // Maskable: launchers crop to a circle/squircle, so keep the mark inside the 60% safe zone.
  await (await squareIcon(source("mark.svg"), 512, 0.56)).toFile(out("icons/maskable-512.png"));

  // Mark used on pages (vector).
  await copyFile(source("mark.svg"), out("icons/mark.svg"));

  // Social preview image: the full logo (mark + wordmark + tagline), cropped to what's drawn.
  const logo = await sharp(source("logo-full.png"))
    .trim({ background: "#ffffff", threshold: 12 })
    .resize(1100, 560, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out("og.png"));

  console.log(`Brand assets generated in brand/${key}/public/`);
}

for (const key of Object.keys(brands)) await generate(key);

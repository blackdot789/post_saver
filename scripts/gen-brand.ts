/**
 * Generates every icon/image the apps need from brand/ sources.
 * Run after changing the logo: `pnpm brand` (outputs are committed).
 */
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const brand = (f: string) => resolve(root, "brand", f);
const webPublic = (f: string) => resolve(root, "apps/web/public", f);

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Renders an SVG centered on a square canvas, occupying `scale` of the side. */
async function squareIcon(svg: string, size: number, scale: number, background = WHITE) {
  const inner = Math.round(size * scale);
  const mark = await sharp(svg, { density: 600 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png();
}

async function main() {
  await mkdir(webPublic("icons"), { recursive: true });

  // Browser tab: the P alone reads best at tiny sizes.
  await copyFile(brand("mark-p.svg"), webPublic("favicon.svg"));
  await (await squareIcon(brand("mark-p.svg"), 32, 0.94, { r: 0, g: 0, b: 0, alpha: 0 })).toFile(webPublic("icons/favicon-32.png"));

  // App icons: full mark (with sparks) on white.
  await (await squareIcon(brand("mark.svg"), 180, 0.72)).toFile(webPublic("icons/apple-touch-icon.png"));
  await (await squareIcon(brand("mark.svg"), 192, 0.72)).toFile(webPublic("icons/icon-192.png"));
  await (await squareIcon(brand("mark.svg"), 512, 0.72)).toFile(webPublic("icons/icon-512.png"));
  // Maskable: launchers crop to a circle/squircle, so keep the mark inside the 60% safe zone.
  await (await squareIcon(brand("mark.svg"), 512, 0.56)).toFile(webPublic("icons/maskable-512.png"));

  // Mark used on pages (vector).
  await copyFile(brand("mark.svg"), webPublic("icons/mark.svg"));

  // Social preview image: the full logo (mark + wordmark + tagline), cropped to content.
  const logo = await sharp(brand("logo-full.png"))
    .extract({ left: 140, top: 268, width: 978, height: 693 })
    .resize(1100, 560, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(webPublic("og.png"));

  console.log("Brand assets generated in apps/web/public/");
}

await main();

/**
 * Regenerate the raster app icons from the SVG masters.
 *
 * The browser tab uses `apps/web/public/icon.svg` directly. Everything that has
 * to be a PNG — the iOS home-screen icon and the three PWA manifest icons — is
 * rendered from the same two SVGs here, so a colour or a shape is edited in one
 * place and the rest follow.
 *
 *   bun run icons
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dir, "../apps/web/public");

function render(svgFile: string, size: number, outFile: string): void {
  const svg = readFileSync(join(dir, svgFile), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  writeFileSync(join(dir, outFile), png);
  console.log(`${outFile}\t${size}×${size}`);
}

render("icon.svg", 180, "apple-touch-icon.png");
render("icon.svg", 192, "pwa-192.png");
render("icon.svg", 512, "pwa-512.png");
render("icon-maskable.svg", 512, "pwa-maskable-512.png");

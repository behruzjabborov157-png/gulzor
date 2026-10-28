// Generates the PWA / Android icons from one SVG (no fonts needed).
// Replace FLOWER_SVG with the shop's own logo later and run: node scripts/generate-icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const FOREST = "#2e4a3b";
const petals = Array.from({ length: 5 }, (_, i) =>
  `<ellipse cx="256" cy="168" rx="58" ry="92" fill="#f3dcd5" transform="rotate(${i * 72} 256 256)"/>`,
).join("");
// `scale` shrinks the flower so it stays inside the maskable safe zone (inner 80%).
const svg = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${FOREST}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${petals}
    <circle cx="256" cy="256" r="46" fill="#b5594b"/><circle cx="256" cy="256" r="20" fill="#fbf8f3"/></g>
</svg>`;

fs.mkdirSync("public/icons", { recursive: true });
const out = [
  ["public/icons/icon-192.png", 192, svg(1, true)],
  ["public/icons/icon-512.png", 512, svg(1, true)],
  ["public/icons/maskable-512.png", 512, svg(0.72, false)],
  ["public/icons/apple-touch-icon.png", 180, svg(0.85, false)],
  ["src/app/icon.png", 64, svg(1, true)],
];
for (const [file, size, s] of out) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}

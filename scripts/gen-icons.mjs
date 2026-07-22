// Rasterizes assets/logo.svg into the PWA / favicon icon set in public/.
// Run with: npm run icons
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const roundedSvg = await readFile("assets/logo.svg", "utf8");
// Square (non-rounded) variant: OS launchers and maskable masks apply their own
// shape, so icon PNGs must be full-bleed squares, not pre-rounded.
const squareSvg = roundedSvg.replace('rx="112"', 'rx="0"');

await mkdir("public", { recursive: true });

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png();

const targets = [
  { svg: squareSvg, size: 192, out: "public/pwa-192x192.png" },
  { svg: squareSvg, size: 512, out: "public/pwa-512x512.png" },
  { svg: squareSvg, size: 512, out: "public/pwa-maskable-512x512.png" },
  { svg: squareSvg, size: 180, out: "public/apple-touch-icon.png" },
  { svg: roundedSvg, size: 96, out: "public/favicon-96x96.png" },
];

for (const { svg, size, out } of targets) {
  await png(svg, size).toFile(out);
  console.log(`✓ ${out} (${size}×${size})`);
}

// Crisp SVG favicon (scales to any size in modern browsers).
await writeFile("public/favicon.svg", roundedSvg);
console.log("✓ public/favicon.svg");

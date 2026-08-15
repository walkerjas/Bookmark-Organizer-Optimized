/**
 * Resizes the ghost PNG to the required extension icon sizes using sharp.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "..", "..", "artifacts", "bookmark-manager", "public", "favicon.png");
const iconsDir = join(root, "public", "icons");

mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(iconsDir, `icon${size}.png`));
  console.log(`  ✓ icon${size}.png`);
}
console.log("Icons generated.");

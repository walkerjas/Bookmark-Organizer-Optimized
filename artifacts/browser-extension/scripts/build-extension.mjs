/**
 * Build the Chrome extension and zip it for distribution.
 * Usage: node scripts/build-extension.mjs
 *
 * Output: dist/markbase-extension.zip
 *         dist/extension/  (loadable via Chrome "Load unpacked")
 */
import { execSync } from "child_process";
import { existsSync, rmSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { deflateRawSync } from "zlib";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── CRC-32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
  return ((crc ^ 0xffffffff) >>> 0);
}

// ── Pure-Node ZIP writer ──────────────────────────────────────────────────────
function createZip(srcDir, destFile) {
  const entries = [];
  function collect(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) collect(full);
      else entries.push({ full, rel: relative(srcDir, full).replace(/\\/g, "/") });
    }
  }
  collect(srcDir);

  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const { full, rel } of entries) {
    const raw = readFileSync(full);
    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const fileData = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);
    const nameBytes = Buffer.from(rel, "utf-8");

    // Local file header (30) + name + data
    const lh = Buffer.alloc(30 + nameBytes.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(fileData.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBytes.copy(lh, 30);

    // Central directory entry (46) + name
    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(fileData.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBytes.copy(cd, 46);

    localParts.push(lh, fileData);
    cdParts.push(cd);
    offset += lh.length + fileData.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(destFile, Buffer.concat([...localParts, cdBuf, eocd]));
}

// ── Build pipeline ─────────────────────────────────────────────────────────────
function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

// 1. Generate icons
run("node scripts/generate-icons.mjs", "Generating icons…");

// 2. Build with extension config
run(
  "pnpm vite build --config vite.extension.config.ts",
  "Building extension bundle…",
);

// 3. Zip the output
const extDir = join(root, "dist", "extension");
const zipPath = join(root, "dist", "markbase-extension.zip");
if (existsSync(zipPath)) rmSync(zipPath);

console.log("\n▶ Creating zip…");
createZip(extDir, zipPath);
const sizeKB = Math.round(statSync(zipPath).size / 1024);
console.log(`  ✓ markbase-extension.zip (${sizeKB} KB)`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Extension built successfully!

📦  dist/markbase-extension.zip  (${sizeKB} KB)
    → Download and share, or upload to Chrome Web Store

📂  dist/extension/
    → Load unpacked in Chrome:
      1. Open chrome://extensions/
      2. Enable Developer mode (top-right toggle)
      3. Click "Load unpacked"
      4. Select the dist/extension/ folder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

#!/usr/bin/env node
/**
 * Measures the distributable source size and optionally builds a clean ZIP.
 *
 *   node scripts/source-size.mjs          # report size (bytes) of distributable files
 *   node scripts/source-size.mjs --zip    # also write release/careerhub-source.zip
 *
 * Excludes dependencies, build output, generated code, caches, logs, local
 * uploads, secrets (.env*, except .env.example) and VCS metadata. Uses only
 * Node.js built-ins (zlib) so it works on Windows, macOS and Linux.
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

const ROOT = process.cwd();
const LIMIT = 30 * 1024 * 1024;
const TARGET = 25 * 1024 * 1024;

const EXCLUDED_DIRS = new Set([
  "node_modules", ".next", "out", "build", "release", "coverage", "test-results", "playwright-report",
  "blob-report", ".git", ".claude", ".idea", ".vscode", "storage", "uploads", "backups",
]);
const EXCLUDED_PATHS = new Set(["src/generated", "tests/e2e/.auth"]);
const isExcludedFile = (name) =>
  (name.startsWith(".env") && name !== ".env.example") ||
  name.endsWith(".log") ||
  name.endsWith(".tsbuildinfo") ||
  name.endsWith(".zip") ||
  name.endsWith(".dump") ||
  name === "next-env.d.ts" ||
  name === ".DS_Store" ||
  name === "Thumbs.db";

function collect(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full).split(sep).join("/");
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_PATHS.has(rel)) continue;
      collect(full, files);
    } else if (entry.isFile() && !isExcludedFile(entry.name)) {
      files.push({ full, rel, size: statSync(full).size });
    }
  }
  return files;
}

// ── Minimal ZIP writer (deflate, CRC-32) ────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files, prefix) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const data = readFileSync(file.full);
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const name = Buffer.from(`${prefix}/${file.rel}`, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(useDeflate ? 8 : 0, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

const fmt = (n) => `${n.toLocaleString("en-US")} bytes (${(n / 1024 / 1024).toFixed(2)} MB)`;
const files = collect(ROOT).sort((a, b) => a.rel.localeCompare(b.rel));
const total = files.reduce((sum, f) => sum + f.size, 0);

console.log(`Distributable source files: ${files.length}`);
console.log(`Distributable source size:  ${fmt(total)}`);
console.log(`Limit: ${fmt(LIMIT)} · target: ${fmt(TARGET)} → ${total <= TARGET ? "OK (within target)" : total <= LIMIT ? "within limit, above target" : "OVER LIMIT"}`);

const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 5);
console.log("Largest files:");
for (const f of largest) console.log(`  ${f.rel}  ${f.size.toLocaleString("en-US")} B`);

if (process.argv.includes("--zip")) {
  const archive = zip(files, "CareerHub");
  mkdirSync(join(ROOT, "release"), { recursive: true });
  const out = join(ROOT, "release", "careerhub-source.zip");
  writeFileSync(out, archive);
  console.log(`ZIP written: ${relative(ROOT, out)} — ${fmt(archive.length)}`);
}

if (total > LIMIT) process.exit(1);

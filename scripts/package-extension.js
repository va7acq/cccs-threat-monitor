import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const manifestPath = path.join(distDir, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  throw new Error("dist/manifest.json not found. Run `npm run build` first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.manifest_version !== 3) {
  throw new Error(`Expected manifest_version 3, got ${manifest.manifest_version}`);
}
if (!manifest.description || manifest.description.length > 132) {
  throw new Error(
    `Manifest description exceeds 132 characters (${manifest.description?.length || 0})`
  );
}

// Ensure required entry files exist inside dist/
const requiredFiles = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons || {}),
].filter(Boolean);

for (const relFile of requiredFiles) {
  const absFile = path.join(distDir, relFile);
  if (!fs.existsSync(absFile)) {
    throw new Error(`Missing required dist file referenced in manifest: ${relFile}`);
  }
}

const zipName = `cccs-threat-monitor-v${manifest.version}.zip`;
const zipPath = path.join(rootDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Package the contents of dist/ directly at the archive root (no top-level dist/ folder)
execFileSync(
  "zip",
  [
    "-r",
    "-X",
    "-q",
    zipPath,
    ".",
    "-x",
    "*.DS_Store",
    "*Thumbs.db",
    "*.map",
    "icons/icon.svg",
  ],
  { cwd: distDir, stdio: "inherit" }
);

const stat = fs.statSync(zipPath);
console.log(
  `Packaged Chrome Web Store archive: ${zipName} (${stat.size} bytes)`
);

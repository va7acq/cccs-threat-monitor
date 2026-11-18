import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourcePath = path.join(rootDir, "PRIVACY.md");
const targetDir = path.join(rootDir, "docs");
const targetPath = path.join(targetDir, "privacy-policy.md");

fs.mkdirSync(targetDir, { recursive: true });

const sourceContent = fs.readFileSync(sourcePath, "utf8");
const existingContent = fs.existsSync(targetPath)
  ? fs.readFileSync(targetPath, "utf8")
  : null;

if (existingContent !== sourceContent) {
  fs.writeFileSync(targetPath, sourceContent, "utf8");
  console.log("Synced PRIVACY.md -> docs/privacy-policy.md");
} else {
  console.log("docs/privacy-policy.md is already in sync with PRIVACY.md");
}

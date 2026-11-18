import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, "../public/icons");

fs.mkdirSync(iconsDir, { recursive: true });

// Official CAN/CGSB-98.1 National Flag of Canada 11-point maple leaf geometry
// (centered at x=2400 on the standard 4800x4800 square) with centered white padlock
const CANADA_FLAG_MAPLE_LEAF_PATH =
  "M 2490 4430 l -45 -863 a 95 95 0 0 1 111 -98 l 859 151 l -116 -320 " +
  "a 65 65 0 0 1 20 -73 l 941 -762 l -212 -99 a 65 65 0 0 1 -34 -79 " +
  "l 186 -572 l -542 115 a 65 65 0 0 1 -73 -38 l -105 -247 l -423 454 " +
  "a 65 65 0 0 1 -111 -57 l 204 -1052 l -327 189 a 65 65 0 0 1 -91 -27 " +
  "l -332 -652 l -332 652 a 65 65 0 0 1 -91 27 l -327 -189 l 204 1052 " +
  "a 65 65 0 0 1 -111 57 l -423 -454 l -105 247 a 65 65 0 0 1 -73 38 " +
  "l -542 -115 l 186 572 a 65 65 0 0 1 -34 79 l -212 99 l 941 762 " +
  "a 65 65 0 0 1 20 73 l -116 320 l 859 -151 a 95 95 0 0 1 111 98 l -45 863 Z";

function buildIconSvg(size = 128) {
  const isSmall = size <= 16;
  const shackleStroke = isSmall ? 255 : 205;
  const keyholeRadius = isSmall ? 140 : 125;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="285 300 4230 4230" width="${size}" height="${size}">
  <!-- Red Maple Leaf (#D80621) - Official Flag of Canada Proportions -->
  <path
    d="${CANADA_FLAG_MAPLE_LEAF_PATH}"
    fill="#D80621"
  />
  <!-- Centered White Padlock (#FFFFFF) -->
  <path
    d="M 2035 2180 L 2035 1860 A 365 365 0 0 1 2765 1860 L 2765 2180"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="${shackleStroke}"
    stroke-linecap="round"
  />
  <rect
    x="1820"
    y="2120"
    width="1160"
    height="920"
    rx="165"
    ry="165"
    fill="#FFFFFF"
  />
  <!-- Keyhole cutout in Maple Leaf Red -->
  <circle cx="2400" cy="2485" r="${keyholeRadius}" fill="#D80621" />
  <path d="M 2332 2535 L 2300 2845 L 2500 2845 L 2468 2535 Z" fill="#D80621" />
</svg>
`;
}

async function renderSvgToPng(svgString, size, outputPath) {
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svgString, {
      fitTo: {
        mode: "width",
        value: size,
      },
      background: "rgba(0, 0, 0, 0)",
    });
    const pngData = resvg.render();
    fs.writeFileSync(outputPath, pngData.asPng());
    return "resvg";
  } catch {
    // Fallback to Inkscape CLI if @resvg/resvg-js native binding is unavailable
    const tempSvg = path.join(iconsDir, `.tmp-${size}.svg`);
    fs.writeFileSync(tempSvg, svgString, "utf8");
    try {
      execFileSync(
        "inkscape",
        [
          tempSvg,
          `--export-filename=${outputPath}`,
          `-w`,
          String(size),
          `-h`,
          String(size),
        ],
        { stdio: "ignore" }
      );
    } finally {
      if (fs.existsSync(tempSvg)) fs.unlinkSync(tempSvg);
    }
    return "inkscape";
  }
}

async function main() {
  const masterSvgPath = path.join(iconsDir, "icon.svg");
  fs.writeFileSync(masterSvgPath, buildIconSvg(128), "utf8");

  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const svg = buildIconSvg(size);
    const outPath = path.join(iconsDir, `icon${size}.png`);
    const engine = await renderSvgToPng(svg, size, outPath);
    const stat = fs.statSync(outPath);
    console.log(
      `Generated ${path.relative(process.cwd(), outPath)} (${size}x${size}, ${stat.size} bytes via ${engine})`
    );
  }
}

main().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});

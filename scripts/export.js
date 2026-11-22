// Export a deck with the custom fonts in fonts/ (and its images next to it).
//   npm run export -- decks/my-talk.opf.md out/my-talk.pptx      (.pptx, .pdf, .svg (one file per slide), .png)
// Why not `opf convert --fonts fonts`? In @openpresentation/cli 0.34.2 that option registers every file as weight 400,
// so a family with both a regular and a bold file fails with "Duplicate face". This script reads each face's
// family, weight and style from the file (server/fonts.js) and passes them explicitly.
import { convert } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadNodeFonts } from "./node-fonts.js";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: npm run export -- <deck.opf.md|json|yaml> <output.pptx|pdf|svg|png>");
  process.exit(2);
}

const { fonts, custom } = await loadNodeFonts();
await mkdir(dirname(resolve(output)), { recursive: true });
const result = await convert(resolve(input), resolve(output), {
  fonts,
  catalogs: [gallery],
  assetDir: dirname(resolve(input)),
  force: true,
});
console.log(JSON.stringify({ ok: true, customFonts: custom, outputs: result?.files?.map?.((f) => f.path ?? f.name) ?? output }, null, 2));

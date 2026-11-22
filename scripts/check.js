// Validate decks with the custom fonts in fonts/, so text fit is measured with the real faces.
//   npm run check -- decks/my-talk.opf.md [more decks…]      (no arguments: every deck in decks/)
// `opf validate` has no --fonts option: on a deck that uses a font from fonts/ it can only report opf/layout-failed.
// Exit code 1 when any deck has an error or a warning.
import { validate, parse } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadNodeFonts } from "./node-fonts.js";
import { DECKS_DIR } from "../server/deck-api.js";

let inputs = process.argv.slice(2);
if (!inputs.length) inputs = (await readdir(DECKS_DIR)).filter((f) => /\.opf\.(md|json|yaml)$/.test(f)).map((f) => resolve(DECKS_DIR, f));

const { fonts } = await loadNodeFonts();
let failed = false;
for (const input of inputs) {
  const text = await readFile(input, "utf8");
  let report;
  try {
    report = validate(parse(text, { filename: input, catalogs: [gallery] }), { catalogs: [gallery], fonts });
  } catch (error) {
    report = { findings: error.report?.findings ?? [{ severity: "error", ruleId: "parse", message: error.message }] };
  }
  const shown = report.findings.filter((f) => f.severity !== "info");
  failed ||= shown.length > 0;
  console.log(`${input}: ${shown.length ? `${shown.length} finding(s)` : "ok"}`);
  for (const f of report.findings) console.log(`  ${f.severity.padEnd(7)} ${f.ruleId}  ${f.path ?? ""}  ${f.message}`);
}
process.exit(failed ? 1 : 0);

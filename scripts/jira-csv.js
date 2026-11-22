// Turn a Jira CSV export into a deck: one table slide of Feature · BV · Ticket · Status, BV cells shaded darker blue
// for higher business value, ticket keys linked to Jira.
//   npm run jira-csv -- epics.csv [objectives.csv …] [--out decks/release-bv.opf.md] [--base https://acme.atlassian.net]
//                                  [--title "…"] [--bv-column "Business Value"]
// A feature is an epic; its BV is the epic's own BV or, when it has none, the BV of its parent issue (the Objective).
// Give the epics and their Objectives in one CSV or in several. Columns are found by their Jira header names: Summary,
// Issue key, Issue id, Issue Type, Status, Parent (or Parent Link), and a BV column whose header contains
// "Business Value" (or is exactly "BV"). JIRA_BASE_URL works instead of --base. Done rows come first, in CSV order;
// the rest follow them. The deck is then validated, as with `npm run check`.
import { validate, parse } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadNodeFonts } from "./node-fonts.js";
import { DECKS_DIR } from "../server/deck-api.js";

const DONE = new Set(["done", "closed", "resolved", "released", "complete", "completed"]);
const LIGHT = [0xdc, 0xe8, 0xff]; // lowest BV
const DARK = [0x0a, 0x3a, 0x8c]; // highest BV

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const out = resolve(option("--out") ?? resolve(DECKS_DIR, "release-bv.opf.md"));
const base = (option("--base") ?? process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, "");
const title = option("--title");
const bvColumn = option("--bv-column");
const inputs = args;
if (!inputs.length) {
  console.error("Usage: npm run jira-csv -- epics.csv [objectives.csv …] [--out decks/x.opf.md] [--base https://acme.atlassian.net] [--title …] [--bv-column …]");
  process.exit(2);
}

// RFC 4180: quoted fields may hold commas, quotes ("") and line breaks. Jira writes a BOM and may repeat a header.
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const sep = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ";" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += '"', i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim()));
}

const COLUMNS = {
  summary: (h) => /^summary$/i.test(h),
  key: (h) => /^issue key$/i.test(h),
  id: (h) => /^issue id$/i.test(h),
  type: (h) => /^issue type$/i.test(h),
  status: (h) => /^status$/i.test(h),
  parent: (h) => /^parent( id| key)?$/i.test(h) || /parent link/i.test(h),
  bv: bvColumn ? (h) => h === bvColumn || h === `Custom field (${bvColumn})` : (h) => /business value/i.test(h) || /^bv$/i.test(h),
};
const issues = [];
const seen = new Set();
for (const input of inputs) {
  const [header, ...body] = parseCsv(await readFile(input, "utf8"));
  const at = Object.fromEntries(Object.entries(COLUMNS).map(([name, test]) => [name, header.findIndex((h) => test(h.trim()))]));
  for (const required of ["summary", "key", "status"]) {
    if (at[required] < 0) {
      console.error(`${input}: no ${required} column. Headers: ${header.join(" | ")}`);
      process.exit(1);
    }
  }
  for (const r of body) {
    const get = (name) => (at[name] < 0 ? "" : (r[at[name]] ?? "").trim());
    if (seen.has(get("key"))) continue;
    seen.add(get("key"));
    const bv = Number.parseFloat(get("bv").replace(",", "."));
    issues.push({
      feature: get("summary"), key: get("key"), id: get("id"), type: get("type").toLowerCase(),
      status: get("status"), done: DONE.has(get("status").toLowerCase()),
      parent: get("parent"), bv: Number.isFinite(bv) ? bv : null,
    });
  }
}

// Features: the epics, or (no Issue Type column) every issue that is not another one's parent.
const byRef = new Map(issues.flatMap((i) => [[i.key, i], ...(i.id ? [[i.id, i]] : [])]));
const parents = new Set(issues.map((i) => byRef.get(i.parent)).filter(Boolean));
const items = issues.some((i) => i.type === "epic") ? issues.filter((i) => i.type === "epic") : issues.filter((i) => !parents.has(i));
if (!items.length) {
  console.error(`${inputs.join(", ")}: no epics found.`);
  process.exit(1);
}
const missing = [];
for (const i of items) {
  if (i.bv === null) i.bv = byRef.get(i.parent)?.bv ?? null;
  if (i.bv === null) missing.push(i);
}
if (missing.length) {
  console.log(`No BV for ${missing.map((i) => i.key).join(", ")}: their Objectives are not in the CSV, or have no BV.`);
  const refs = missing.map((i) => i.parent).filter((p) => p && !byRef.has(p));
  if (refs.length) console.log(`  Export the Objectives too, with this JQL:  issue in (${refs.join(", ")})`);
}
items.sort((a, b) => b.done - a.done); // stable: CSV order within each group

const values = items.map((i) => i.bv).filter((v) => v !== null);
if (!values.length) {
  console.error("No BV numbers: give the Objectives' CSV too (see above).");
  process.exit(1);
}
const [min, max] = [Math.min(...values), Math.max(...values)];
const shade = (v) => {
  const t = max > min ? (v - min) / (max - min) : 0.5;
  return "#" + LIGHT.map((a, i) => Math.round(a + (DARK[i] - a) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
};
const bvText = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

const open = items.filter((i) => !i.done);
const heading =
  title ??
  (open.length === 0
    ? `All ${items.length} features are done`
    : open.length === 1
      ? `${open[0].feature} is the last feature left`
      : `${items.length - open.length} of ${items.length} features are done`);

// Flow-style YAML; JSON.stringify quotes every string, so summaries with colons, quotes or brackets stay safe.
const q = JSON.stringify;
const center = { align: "center" };
const header4 = ["Feature", { value: "BV", style: center }, { value: "Ticket", style: center }, { value: "Status", style: center }];
const rows = items.map((i) => {
  const bv = i.bv === null ? "" : { value: bvText(i.bv), style: { fill: shade(i.bv), bold: true, align: "center" } };
  const ticket = base ? [{ text: i.key, link: `${base}/browse/${i.key}` }] : i.key;
  const status = i.done ? "Done" : [{ text: i.status, bold: true, color: "accent1" }];
  return `    - ${q([i.feature, bv, ticket, status])}`;
});
const today = new Date().toLocaleDateString("sv"); // local YYYY-MM-DD
const deck = `---
name: ${q(heading)}
language: en-US
design:
  theme: classic
  colorScheme: corporate-blue
  fontScheme:
    major: Montserrat
    minor: Roboto
  background: light1
---

<!-- slide: id=features layout=table -->
# ${heading}

\`\`\`opf-block
table:
  columns: ${q(header4)}
  rows:
${rows.join("\n")}
caption: ${q(`Darker blue means higher business value (BV). Source: Jira export, ${today}.`)}
\`\`\`
`;
await writeFile(out, deck);
console.log(`${out}: ${items.length} features, ${open.length} not done, BV ${bvText(min)}–${bvText(max)}${base ? "" : " (no --base: tickets are not linked)"}`);
if (items.length > 12) console.log("  More than 12 rows: the table text shrinks; consider splitting the slide.");

const { fonts } = await loadNodeFonts();
const report = validate(parse(deck, { filename: out, catalogs: [gallery] }), { catalogs: [gallery], fonts });
const shown = report.findings.filter((f) => f.severity !== "info");
for (const f of shown) console.log(`  ${f.severity.padEnd(7)} ${f.ruleId}  ${f.path ?? ""}  ${f.message}`);
process.exit(shown.length ? 1 : 0);

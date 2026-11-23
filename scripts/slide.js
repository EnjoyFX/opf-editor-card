// Change one slide of a Markdown deck by its id, leaving the rest of the file as it is.
//   npm run slide -- list   decks/x.opf.md
//   npm run slide -- get    decks/x.opf.md <id> [slide.md]           (no file: print it)
//   npm run slide -- set    decks/x.opf.md slide.md [--id <id>] [--after <id> | --before <id>]
//   npm run slide -- remove decks/x.opf.md <id>
// `set` replaces the slide with the same id, or inserts it (at the end, or after/before another slide). `set` and `remove`
// validate the new deck with the custom fonts first and write nothing when it has an error; warnings are printed.
import { readFile, writeFile } from "node:fs/promises";
import { listSlides, getSlide, setSlide, removeSlide, checkDeck, formatFinding } from "./slides.js";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const opts = { id: option("--id"), after: option("--after"), before: option("--before") };
const [command, deckPath, arg, arg2] = args;
const usage = () => {
  console.error("Usage: npm run slide -- list|get|set|remove <deck.opf.md> … (see scripts/slide.js)");
  process.exit(2);
};
if (!command || !deckPath || !/\.opf\.md$/.test(deckPath)) usage();

const fail = (message) => {
  console.error(`${deckPath}: ${message}`);
  process.exit(1);
};

async function save(text, what) {
  const findings = await checkDeck(text, deckPath);
  const errors = findings.filter((f) => f.severity === "error");
  for (const f of findings) console.log(formatFinding(f));
  if (errors.length) fail(`not written: the deck would have ${errors.length} error(s).`);
  await writeFile(deckPath, text);
  console.log(`${deckPath}: ${what}${findings.length ? `, ${findings.length} warning(s)` : ""}`);
}

const text = await readFile(deckPath, "utf8");
try {
  if (command === "list") {
    for (const s of listSlides(text)) console.log(`${String(s.n).padStart(3)}  ${(s.id ?? "-").padEnd(20)} ${s.title ?? ""}`);
  } else if (command === "get") {
    if (!arg) usage();
    const slide = getSlide(text, arg);
    if (slide === undefined) fail(`no slide with id "${arg}"`);
    if (arg2) await writeFile(arg2, slide + "\n");
    else console.log(slide);
  } else if (command === "set") {
    if (!arg) usage();
    if (opts.after && opts.before) fail("give --after or --before, not both");
    const result = setSlide(text, await readFile(arg, "utf8"), opts);
    await save(result.text, `slide "${result.id}" ${result.action}`);
  } else if (command === "remove") {
    if (!arg) usage();
    await save(removeSlide(text, arg), `slide "${arg}" removed`);
  } else usage();
} catch (error) {
  fail(error.message);
}

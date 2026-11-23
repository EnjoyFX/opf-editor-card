// Slides of a Markdown deck addressed by id, as text: list them, read one, replace or insert one, remove one.
// Only the addressed slide's text changes; the front matter and the other slides keep their exact text. Slides are joined
// by "\n\n---\n\n". A slide's id is the `id=` of its `<!-- slide: … -->` comment (an id set only inside an opf-slide
// fence is not seen).
import { validate, parse } from "@openpresentation/opf";
import { gallery } from "@openpresentation/gallery";
import { scanMarkdown } from "@openpresentation/opf/source";
import { loadNodeFonts } from "./node-fonts.js";

const SEPARATOR = "\n\n---\n\n";
const ID = /(^|\s)id=(?:"((?:[^"\\]|\\.)*)"|([^\s"]+))/;

function split(text) {
  const scan = scanMarkdown(text);
  const slides = scan.slides.map((s) => {
    const options = scan.comments.find((c) => c.kind === "slide" && c.slide === s.index);
    const match = options && text.slice(options.innerFrom, options.innerTo).match(ID);
    const id = match ? (match[2] !== undefined ? JSON.parse(`"${match[2]}"`) : match[3]) : undefined;
    const body = text.slice(s.from, s.to);
    return { id, text: body, title: body.match(/^#\s+(.*)$/m)?.[1].trim() };
  });
  const head = scan.slides.length ? text.slice(0, scan.slides[0].from).replace(/\s*$/, "\n\n") : text.replace(/\s*$/, "\n\n");
  return { head, slides };
}

const join = ({ head, slides }) => head + slides.map((s) => s.text).join(SEPARATOR) + "\n";

/** [{ n, id, title }] in deck order; n is 1-based. */
export function listSlides(text) {
  return split(text).slides.map((s, i) => ({ n: i + 1, id: s.id, title: s.title }));
}

/** The text of the slide with this id, or undefined. */
export function getSlide(text, id) {
  return split(text).slides.find((s) => s.id === id)?.text;
}

/**
 * Put one slide into a deck. The slide text holds exactly one slide and no front matter. Its id is its own `id=`, or
 * `id` (added to its options comment when it has none). A slide with that id is replaced in place; otherwise the slide is
 * inserted after the slide `after`, before the slide `before`, or at the end. Returns { text, id, action }.
 */
export function setSlide(text, slideText, { id, after, before } = {}) {
  const piece = split(slideText.replace(/^﻿/, ""));
  if (scanMarkdown(slideText).frontMatter) throw new Error("the slide has front matter; give one slide only");
  if (piece.slides.length !== 1) throw new Error(`the slide text holds ${piece.slides.length} slides; give exactly one`);
  let slide = piece.slides[0];
  if (id && slide.id && slide.id !== id) throw new Error(`the slide's own id is "${slide.id}", not "${id}"`);
  if (!slide.id) {
    if (!id) throw new Error('the slide has no id: add <!-- slide: id=… --> or pass an id');
    if (!/^[\w.-]+$/.test(id)) throw new Error(`id "${id}" may use letters, digits, "_", "." and "-" only`);
    const withId = /<!--\s*slide:/.test(slide.text)
      ? slide.text.replace(/<!--\s*slide:/, (m) => `${m} id=${id}`)
      : `<!-- slide: id=${id} -->\n${slide.text}`;
    slide = { ...slide, id, text: withId };
  }
  const deck = split(text);
  const at = deck.slides.findIndex((s) => s.id === slide.id);
  if (at >= 0) {
    deck.slides[at] = slide;
    return { text: join(deck), id: slide.id, action: "replaced" };
  }
  const anchor = after ?? before;
  let index = deck.slides.length;
  if (anchor) {
    const i = deck.slides.findIndex((s) => s.id === anchor);
    if (i < 0) throw new Error(`no slide with id "${anchor}"`);
    index = after ? i + 1 : i;
  }
  deck.slides.splice(index, 0, slide);
  return { text: join(deck), id: slide.id, action: "inserted" };
}

/** The deck without the slide with this id. */
export function removeSlide(text, id) {
  const deck = split(text);
  const at = deck.slides.findIndex((s) => s.id === id);
  if (at < 0) throw new Error(`no slide with id "${id}"`);
  deck.slides.splice(at, 1);
  return join(deck);
}

let fontsPromise;
/** Validate deck text with the custom fonts, as `npm run check` does: the findings other than info. */
export async function checkDeck(text, filename) {
  fontsPromise ??= loadNodeFonts();
  const { fonts } = await fontsPromise;
  try {
    return validate(parse(text, { filename, catalogs: [gallery] }), { catalogs: [gallery], fonts }).findings.filter((f) => f.severity !== "info");
  } catch (error) {
    return error.report?.findings?.filter((f) => f.severity !== "info") ?? [{ severity: "error", ruleId: "parse", message: error.message }];
  }
}

export const formatFinding = (f) => `  ${f.severity.padEnd(7)} ${f.ruleId}  ${f.path ?? ""}  ${f.message}`;

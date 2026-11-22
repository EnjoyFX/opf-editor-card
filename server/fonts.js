// Custom font files: every .ttf/.otf in FONTS_DIR, described from the file itself.
// The renderer does not read a face's weight from the file (a face without one counts as 400), so the family, weight
// and style are read here with fontkit and passed explicitly, both to the browser and to scripts/export.js.
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as fontkit from "fontkit";
import { lazyFontList } from "@openpresentation/opf-render/fonts-browser";
import { previewBaseFaces } from "@openpresentation/opf-render/preview-fonts";

// Faces the renderer already bundles (Roboto, Montserrat, Poppins, Open Sans…). Registering one again fails with
// "Duplicate face", so a copy in fonts/ is skipped and the bundled face is used.
const faceId = (f) => `${f.family.toLowerCase()}:${f.weight}:${Boolean(f.italic)}`;
const BUNDLED = new Set([...lazyFontList(), ...previewBaseFaces()].map(faceId));

export const FONTS_DIR = resolve(process.env.FONTS_DIR ?? resolve(import.meta.dirname, "..", "fonts"));
export const FONT_FILE = /^[\w .()-]+\.(ttf|otf)$/i;

const warned = new Set();

export async function listFonts() {
  let files;
  try {
    files = (await readdir(FONTS_DIR)).filter((f) => FONT_FILE.test(f)).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const faces = [];
  for (const file of files) {
    const path = resolve(FONTS_DIR, file);
    const data = await readFile(path);
    try {
      const font = fontkit.create(data);
      const os2 = font["OS/2"];
      const face = {
        file,
        path,
        family: font.getName?.("preferredFamily") ?? font.familyName,
        weight: os2?.usWeightClass ?? 400,
        italic: Boolean(os2?.fsSelection?.italic || font.italicAngle),
        sha256: createHash("sha256").update(data).digest("hex"),
      };
      if (BUNDLED.has(faceId(face))) {
        if (!warned.has(file)) console.warn(`fonts/${file}: ${face.family} ${face.weight} is already bundled; using the bundled face.`);
        warned.add(file);
        continue;
      }
      faces.push(face);
    } catch (error) {
      console.warn(`Skipping ${file}: not a readable font (${error.message})`);
    }
  }
  return faces;
}

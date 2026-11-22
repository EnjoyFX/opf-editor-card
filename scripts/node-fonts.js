// The Node fonts handle for scripts: the renderer's office pack plus the faces in fonts/, with their real weights.
import { loadFonts } from "@openpresentation/opf-render/fonts-node";
import { listFonts } from "../server/fonts.js";

export async function loadNodeFonts() {
  const custom = await listFonts(); // skips faces the renderer already bundles
  const fonts = await loadFonts({
    pack: "office",
    faces: custom.map(({ path, family, weight, italic }) => ({ path, family, weight, italic })),
  });
  return { fonts, custom: custom.map((f) => `${f.family} ${f.weight}${f.italic ? " italic" : ""}`) };
}

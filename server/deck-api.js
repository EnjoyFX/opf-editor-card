// The HTTP API, shared by the Vite dev server and server/serve.js.
//   GET  /api/decks           -> ["a.opf.md", ...]
//   GET  /api/decks/<name>    -> the deck's text
//   PUT  /api/decks/<name>    -> writes the request body (creates or replaces)
//   GET  /api/files/<path>    -> an image inside DECKS_DIR (for decks that use ./images/bg.png and the like)
//   GET  /api/fonts           -> [{ family, weight, italic, sha256, url }] for every font file in FONTS_DIR
//   GET  /api/fonts/<file>    -> the font file
// Deck names are flat *.opf.{md,json,yaml}; images and fonts never resolve outside their folder.
// There is no authentication: keep the server on localhost or put it behind your app's auth.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, basename, extname, sep } from "node:path";
import { FONTS_DIR, FONT_FILE, listFonts } from "./fonts.js";

export const DECKS_DIR = resolve(process.env.DECKS_DIR ?? resolve(import.meta.dirname, "..", "decks"));
const DECK_NAME = /^[\w.-]+\.opf\.(md|json|yaml)$/;
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Handles a path under /api. Returns false when the path is not an API route. */
export async function handleApi(req, res, pathname) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (pathname === "/api/decks" || pathname.startsWith("/api/decks/")) await decks(req, res, pathname.slice(10));
    else if (pathname.startsWith("/api/files/")) await files(req, res, pathname.slice(11));
    else if (pathname === "/api/fonts" || pathname.startsWith("/api/fonts/")) await fonts(req, res, pathname.slice(10));
    else return false;
  } catch (error) {
    res.statusCode = error.status ?? (error.code === "ENOENT" ? 404 : 500);
    res.end(String(error.message));
  }
  return true;
}

async function decks(req, res, path) {
  const name = basename(decodeURIComponent(path.replace(/^\/+/, "")));
  await mkdir(DECKS_DIR, { recursive: true });
  if (!name) {
    allow(req, "GET");
    const list = (await readdir(DECKS_DIR)).filter((f) => DECK_NAME.test(f)).sort();
    return json(res, list);
  }
  if (!DECK_NAME.test(name)) throw httpError(400, "not a deck file name (*.opf.md, *.opf.json or *.opf.yaml)");
  const file = resolve(DECKS_DIR, name);
  if (req.method === "PUT") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BYTES) throw httpError(413, "deck too large");
    }
    await writeFile(file, body);
    return res.end("saved");
  }
  allow(req, "GET");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(await readFile(file, "utf8"));
}

async function files(req, res, path) {
  allow(req, "GET");
  const file = resolve(DECKS_DIR, decodeURIComponent(path));
  const type = IMAGE_TYPES[extname(file).toLowerCase()];
  if (!file.startsWith(DECKS_DIR + sep) || !type) throw httpError(400, "not an image inside the decks folder");
  res.setHeader("Content-Type", type);
  res.end(await readFile(file));
}

async function fonts(req, res, path) {
  allow(req, "GET");
  const name = basename(decodeURIComponent(path.replace(/^\/+/, "")));
  if (!name) {
    const faces = await listFonts();
    return json(res, faces.map(({ family, weight, italic, sha256, file }) => ({ family, weight, italic, sha256, url: `api/fonts/${encodeURIComponent(file)}` })));
  }
  if (!FONT_FILE.test(name)) throw httpError(400, "not a font file");
  res.setHeader("Content-Type", name.toLowerCase().endsWith(".otf") ? "font/otf" : "font/ttf");
  res.end(await readFile(resolve(FONTS_DIR, name)));
}

function json(res, value) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function allow(req, method) {
  if (req.method !== method) throw httpError(405, "method not allowed");
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

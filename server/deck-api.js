// The deck file API, shared by the Vite dev server and server/serve.js.
//   GET  /api/decks         -> ["a.opf.md", ...]
//   GET  /api/decks/<name>  -> the file's text
//   PUT  /api/decks/<name>  -> writes the request body (creates or replaces)
// Only flat names matching *.opf.{md,json,yaml} inside DECKS_DIR are accepted.
// There is no authentication: keep the server on localhost or put it behind your app's auth.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, basename } from "node:path";

export const DECKS_DIR = resolve(process.env.DECKS_DIR ?? resolve(import.meta.dirname, "..", "decks"));
const DECK_NAME = /^[\w.-]+\.opf\.(md|json|yaml)$/;
const MAX_BYTES = 10 * 1024 * 1024;

export async function handleDeckApi(req, res, path) {
  const name = basename(decodeURIComponent(path.replace(/^\/+/, "")));
  res.setHeader("Cache-Control", "no-store");
  try {
    await mkdir(DECKS_DIR, { recursive: true });
    if (!name) {
      if (req.method !== "GET") throw httpError(405, "method not allowed");
      const files = (await readdir(DECKS_DIR)).filter((f) => DECK_NAME.test(f)).sort();
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(files));
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
    if (req.method !== "GET") throw httpError(405, "method not allowed");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(await readFile(file, "utf8"));
  } catch (error) {
    res.statusCode = error.status ?? (error.code === "ENOENT" ? 404 : 500);
    res.end(String(error.message));
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

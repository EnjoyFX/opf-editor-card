// Production server: serves the built page (dist/) and the deck file API. No dependencies.
//   npm run build && npm start      -> http://127.0.0.1:5179/
// HOST, PORT and DECKS_DIR are read from the environment.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, normalize } from "node:path";
import { handleDeckApi, DECKS_DIR } from "./deck-api.js";

const DIST = resolve(import.meta.dirname, "..", "dist");
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 5179);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/api/decks" || pathname.startsWith("/api/decks/")) {
    return handleDeckApi(req, res, pathname.slice("/api/decks".length));
  }
  const file = resolve(DIST, "." + normalize(pathname === "/" ? "/index.html" : decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  try {
    const body = await readFile(file);
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(PORT, HOST, () => console.log(`opf-editor-card on http://${HOST}:${PORT}/ (decks: ${DECKS_DIR})`));

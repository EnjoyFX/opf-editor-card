import { defineConfig } from "vite";
import { handleDeckApi } from "./server/deck-api.js";

export default defineConfig({
  // Relative URLs, so the built page also works when your app serves it under a sub-path.
  base: "./",
  server: { port: 5179 },
  build: { target: "esnext", chunkSizeWarningLimit: 6000 },
  optimizeDeps: { include: ["@openpresentation/opf"] },
  plugins: [
    {
      name: "deck-api",
      configureServer(server) {
        server.middlewares.use("/api/decks", (req, res) => handleDeckApi(req, res, req.url.split("?")[0]));
      },
    },
  ],
});

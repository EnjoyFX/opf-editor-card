import { defineConfig } from "vite";
import { handleApi } from "./server/deck-api.js";

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
        server.middlewares.use(async (req, res, next) => {
          const pathname = req.url.split("?")[0];
          if (!pathname.startsWith("/api/") || (await handleApi(req, res, pathname)) === false) next();
        });
      },
    },
  ],
});

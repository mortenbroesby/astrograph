import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const observabilityDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: observabilityDir,
  build: {
    outDir: path.resolve(observabilityDir, "../observability-dist"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    cors: {
      origin: true,
    },
  },
});

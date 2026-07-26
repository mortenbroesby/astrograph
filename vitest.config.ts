import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#astrograph": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    exclude: configDefaults.exclude,
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The site imports the library's pure modules (totals, validation, labels)
// straight from source, so the numbers on the page come from the shipped code.
const kitSource = fileURLToPath(new URL("../packages/typescript/src", import.meta.url));

export default defineConfig({
  base: "./",
  resolve: {
    alias: { "@kit": kitSource }
  },
  server: {
    fs: { allow: [".."] }
  },
  build: {
    target: "es2022"
  }
});

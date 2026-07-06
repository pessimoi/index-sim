import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { hiscoresApiPlugin } from "./src/server/vite-hiscores-middleware";
import { marketApiPlugin } from "./src/server/vite-market-middleware";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const publicDir = fileURLToPath(new URL("./public", import.meta.url));
const outDir = fileURLToPath(new URL("./dist", import.meta.url));
const cacheDir = fileURLToPath(new URL("./node_modules/.vite", import.meta.url));

export default defineConfig({
  root: projectRoot,
  publicDir,
  cacheDir,
  plugins: [hiscoresApiPlugin(), marketApiPlugin(), react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [projectRoot]
    }
  },
  build: {
    outDir,
    emptyOutDir: true
  }
});

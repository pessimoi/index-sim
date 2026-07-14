import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const measurementHtml = fileURLToPath(new URL("./worker-measurement.html", import.meta.url));
const measurementOutDir = fileURLToPath(new URL("../.worker-measurement-dist", import.meta.url));

export default defineConfig({
  root: projectRoot,
  publicDir: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url))
    }
  },
  build: {
    target: "es2022",
    outDir: measurementOutDir,
    emptyOutDir: true,
    rollupOptions: {
      input: measurementHtml
    }
  }
});

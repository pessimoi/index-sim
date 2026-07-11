import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";
import { hiscoresApiPlugin } from "./src/server/vite-hiscores-middleware";
import { createLostCityHiscoresProvider } from "./src/server/lostcity-hiscores-provider";
import { marketApiPlugin } from "./src/server/vite-market-middleware";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const publicDir = fileURLToPath(new URL("./public", import.meta.url));
const outDir = fileURLToPath(new URL("./dist", import.meta.url));
const cacheDir = fileURLToPath(new URL("./node_modules/.vite", import.meta.url));
const scheduledPriceAssetFiles = ["prices.json", "alch.json", "price-history.json"] as const;
const archivedLegacyJsxFiles = new Set(["planner.jsx", "views.jsx"]);
const hiscoresProvider = createLostCityHiscoresProvider();

function archivedLegacyRuntimePlugin(): Plugin {
  return {
    name: "index-sim-archived-legacy-runtime",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname.replace(
          /^\/+/,
          ""
        );
        if (!archivedLegacyJsxFiles.has(pathname)) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(readFileSync(join(projectRoot, pathname)));
      });
    }
  };
}

function scheduledPriceAssetsPlugin(): Plugin {
  const assetFileSet = new Set<string>(scheduledPriceAssetFiles);

  const attachStaticPriceAssetMiddleware = (
    server: Pick<ViteDevServer | PreviewServer, "middlewares">
  ) => {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname.replace(/^\/+/, "");
      if (!assetFileSet.has(pathname)) {
        next();
        return;
      }

      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(readFileSync(join(projectRoot, pathname)));
    });
  };

  return {
    name: "index-sim-scheduled-price-assets",
    configureServer(server) {
      attachStaticPriceAssetMiddleware(server);
    },
    configurePreviewServer(server) {
      attachStaticPriceAssetMiddleware(server);
    },
    generateBundle() {
      for (const fileName of scheduledPriceAssetFiles) {
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(join(projectRoot, fileName))
        });
      }
    }
  };
}

export default defineConfig({
  root: projectRoot,
  publicDir,
  cacheDir,
  plugins: [
    archivedLegacyRuntimePlugin(),
    scheduledPriceAssetsPlugin(),
    hiscoresApiPlugin({ provider: hiscoresProvider }),
    marketApiPlugin(),
    react()
  ],
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

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
const scheduledPriceAssetFiles = [
  "prices.json",
  "price-provenance.json",
  "alch.json",
  "price-history.json"
] as const;
const archivedLegacyJsxFiles = new Set(["planner.jsx", "views.jsx"]);
const hiscoresProvider = createLostCityHiscoresProvider();

export function isDirectScheduledPriceAssetRequest(
  requestMethod: string | undefined,
  requestUrlValue: string | undefined
): boolean {
  const method = requestMethod?.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const requestUrl = new URL(requestUrlValue ?? "/", "http://localhost");
  const pathname = requestUrl.pathname.replace(/^\/+/, "");
  return (
    requestUrl.search === "" &&
    scheduledPriceAssetFiles.includes(pathname as (typeof scheduledPriceAssetFiles)[number])
  );
}

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
  const attachStaticPriceAssetMiddleware = (
    server: Pick<ViteDevServer | PreviewServer, "middlewares">
  ) => {
    server.middlewares.use((request, response, next) => {
      if (!isDirectScheduledPriceAssetRequest(request.method, request.url)) {
        next();
        return;
      }

      const pathname = new URL(request.url ?? "/", "http://localhost").pathname.replace(/^\/+/, "");

      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        request.method?.toUpperCase() === "HEAD"
          ? undefined
          : readFileSync(join(projectRoot, pathname))
      );
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

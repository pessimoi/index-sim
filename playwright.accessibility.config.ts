import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const PORT = 5174;

export default defineConfig({
  ...baseConfig,
  fullyParallel: false,
  workers: 1,
  use: {
    ...baseConfig.use,
    baseURL: `http://127.0.0.1:${PORT}`
  },
  webServer: {
    command: `bash -lc 'npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT}'`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 180000
  }
});

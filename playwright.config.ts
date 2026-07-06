import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command:
      "bash -lc 'node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --port 5173'",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120000
  }
});

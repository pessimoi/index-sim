import { defineConfig, devices } from "@playwright/test";

const port = 5174;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: "**/*.visual.spec.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  outputDir: "test-results/visual",
  timeout: 90_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.2,
      maxDiffPixelRatio: 0.001
    }
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  projects: [
    {
      name: process.platform,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        baseURL,
        colorScheme: "light",
        locale: "en-US",
        trace: "on-first-retry"
      }
    }
  ],
  webServer: {
    command: `bash -lc 'npm run build && npm run preview -- --host 127.0.0.1 --port ${port}'`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000
  }
});

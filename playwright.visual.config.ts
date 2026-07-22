import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.VISUAL_TEST_PORT ?? "5174", 10);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.VISUAL_REUSE_EXISTING_SERVER === "1";
const disableWebServer = process.env.VISUAL_DISABLE_WEB_SERVER === "1";

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
        timezoneId: "UTC",
        trace: "on-first-retry"
      }
    }
  ],
  webServer: disableWebServer
    ? undefined
    : {
        command: `bash -lc 'npm run build && npm run preview -- --host 127.0.0.1 --port ${port}'`,
        url: baseURL,
        reuseExistingServer,
        timeout: 180_000
      }
});

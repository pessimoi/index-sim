import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: "cross-browser-release.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: ".cross-browser-test-results",
  use: {
    baseURL: "http://127.0.0.1:5176",
    timezoneId: "UTC",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], timezoneId: "UTC" }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], timezoneId: "UTC" }
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], timezoneId: "UTC" }
    }
  ],
  webServer: {
    command: "bash -lc 'npm run build && npm run preview -- --host 127.0.0.1 --port 5176'",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
    timeout: 180_000
  }
});

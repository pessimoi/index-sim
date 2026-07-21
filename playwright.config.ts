import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  testIgnore: ["**/*.visual.spec.ts", "**/cross-browser-release.spec.ts"],
  timeout: 60000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    timezoneId: "UTC",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], timezoneId: "UTC" }
    }
  ],
  webServer: {
    command: "bash -lc 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173'",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 180000
  }
});

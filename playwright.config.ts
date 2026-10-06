import { defineConfig, devices } from "@playwright/test";

// A supplied URL tests the deployed demo; async fixtures remain local-only.
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: deployedURL ? "**/providers.spec.ts" : "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: deployedURL ?? "http://127.0.0.1:5187/forms/",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: deployedURL
    ? undefined
    : {
        command: "npm run dev -- --port 5187 --strictPort",
        url: "http://127.0.0.1:5187/forms/",
        reuseExistingServer: false,
      },
});

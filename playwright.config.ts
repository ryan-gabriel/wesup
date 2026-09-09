import { defineConfig, devices } from "@playwright/test";

// E2E for the supplier dashboard flow. Uses the locally installed Edge (channel:
// "msedge") so no extra Playwright browser binaries need to be downloaded.
export default defineConfig({
  testDir: "./tests/e2e",
  // Full execution only when explicitly asked via `npm run test:e2e`.
  // Dev server is started by the `webServer` config below.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "Supplier Flow", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

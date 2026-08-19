import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "custom_components/dashboardmodern/frontend/e2e",
  // The list reporter is on in CI as well: the dot line the github reporter
  // prints says how many tests failed and nothing about which, and the html
  // report is an artifact you have to download to read. A job that goes red
  // should say why in its own log.
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: process.env.CI ? 10_000 : 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m http.server 4173 --directory custom_components/dashboardmodern/frontend",
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
    { name: "webkit-ipad", use: { ...devices["iPad Pro 11"], browserName: "webkit" } },
  ],
});

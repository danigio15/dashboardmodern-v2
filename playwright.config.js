import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "custom_components/dashboardmodern/frontend/e2e",
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
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "webkit-ipad", use: { ...devices["iPad Pro 11"], browserName: "webkit" } },
  ],
});

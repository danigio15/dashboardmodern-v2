import { expect } from "@playwright/test";

export async function bootNamespacedDashboard(page, variant, testInfo, seed) {
  const instance = [
    "e2e",
    testInfo.project.name,
    variant.replace(/\W+/g, "-"),
    Math.random().toString(36).slice(2),
  ].join("-");

  await page.goto(`/legacy/${variant}?dmi=${encodeURIComponent(instance)}`);
  await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_STORAGE_NS__));
  await page.evaluate((dashboardSeed) => {
    localStorage.clear();
    localStorage.setItem("dm_dashboard_state", JSON.stringify(dashboardSeed));
    localStorage.setItem(
      "cd_connection",
      JSON.stringify({
        token: "e2e-token",
        ws_url: "ws://home-assistant.test/api/websocket",
      }),
    );
  }, seed);
  await page.reload();
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await expect
    .poll(() => page.evaluate(() => DashboardModernModules.store.getState()))
    .toMatchObject({ schema_version: 4 });
}

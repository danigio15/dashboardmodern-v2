import { expect } from "@playwright/test";

async function disableSriForMockedExternalScripts(page) {
  // Browser E2E deliberately replaces remote CDN scripts with deterministic
  // local stubs. SRI correctly rejects those stubs because their bytes differ
  // from production. Strip integrity only from the served E2E document; the
  // committed legacy HTML remains pinned/SRI-protected and is checked by the
  // frontend hardening tests.
  await page.route(/\/legacy\/dashboard(?:-en)?\.html(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /\s+integrity="sha384-[^"]+"\s+crossorigin="anonymous"/g,
      "",
    );
    await route.fulfill({ response, body });
  });
}

export async function bootNamespacedDashboard(page, variant, testInfo, seed) {
  await disableSriForMockedExternalScripts(page);
  const instance = [
    "e2e",
    testInfo.project.name,
    variant.replace(/\W+/g, "-"),
    Math.random().toString(36).slice(2),
  ].join("-");

  // Seed the raw namespaced keys before dashboard scripts start. This avoids a
  // WebKit race where the first runtime writes an empty migrated state between
  // the post-load seed and page.reload(). The guard keeps later reloads from
  // resetting changes made by the test.
  await page.addInitScript(
    ({ dashboardSeed, storageInstance }) => {
      const storage = window.localStorage;
      const prefix = `cd_${storageInstance}_`;
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      const setIfMissing = (key, value) => {
        const rawKey = `${prefix}${key}`;
        if (getItem.call(storage, rawKey) === null) {
          setItem.call(storage, rawKey, value);
        }
      };

      setIfMissing("dm_dashboard_state", JSON.stringify(dashboardSeed));
      setIfMissing(
        "cd_connection",
        JSON.stringify({
          token: "e2e-token",
          ws_url: "ws://home-assistant.test/api/websocket",
        }),
      );
    },
    { dashboardSeed: seed, storageInstance: instance },
  );

  await page.goto(`/legacy/${variant}?dmi=${encodeURIComponent(instance)}`);
  await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_STORAGE_NS__));
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await expect
    .poll(() => page.evaluate(() => DashboardModernModules.store.getState()))
    .toMatchObject({ schema_version: 4 });
  if (testInfo.project.name === "webkit-ipad") {
    await expect(page.locator("html")).toHaveClass(/dm-touch-navigation/);
    await expect(page.locator("#bottomNavHandle")).toBeVisible();
  }
}

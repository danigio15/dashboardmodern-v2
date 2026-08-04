import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab } from "./helpers/navigation.js";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: historical Report never overwrites current Energy flow values`, async ({
    page,
  }, testInfo) => {
    await bootConsolidatedDashboard(page, variant, testInfo);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          solar: Number(CD_PERIOD["dm.energy_produzione_solare_mese"]),
          home: Number(CD_PERIOD["dm.energy_consumo_casa_mese"]),
        })),
      )
      .toEqual({ solar: 50.2, home: 39.9 });

    await clickBottomTab(page, "energy", testInfo);
    await page.evaluate(() => {
      const { month: selectedMonth, year: selectedYear } = window.__dmSelectedPeriod;
      const month = document.getElementById("ed-sel-month");
      const year = document.getElementById("ed-sel-year");
      month.value = String(selectedMonth);
      year.value = String(selectedYear);
      month.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(page.locator("#ed-kpi-prod")).toContainText(/90(?:[,.]0)?/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/86(?:[,.]0)?/);

    const currentFlow = await page.evaluate(() => ({
      solar: Number(CD_PERIOD["dm.energy_produzione_solare_mese"]),
      home: Number(CD_PERIOD["dm.energy_consumo_casa_mese"]),
      polling: window.__DASHBOARDMODERN_RUNTIME_0150__?.metrics?.permanentIntervals,
      observers: window.__DASHBOARDMODERN_RUNTIME_0150__?.metrics?.documentObservers,
    }));
    expect(currentFlow).toEqual({ solar: 50.2, home: 39.9, polling: 0, observers: 0 });

    const sockets = await page.evaluate(() => window.__dmSocketInstances);
    await page.waitForTimeout(1200);
    await expect.poll(() => page.evaluate(() => window.__dmSocketInstances)).toBe(sockets);
    expect(sockets).toBe(1);

    const loadedPatchLayers = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => /release-01(?:47|49|50|51|54|55|56|57)-/.test(name)),
    );
    expect(loadedPatchLayers).toEqual([]);
  });
}

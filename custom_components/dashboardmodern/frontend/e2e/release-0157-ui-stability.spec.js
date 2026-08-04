import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab } from "./helpers/navigation.js";

async function selectPreviousMonth(page) {
  await page.evaluate(() => {
    const { month: selectedMonth, year: selectedYear } = window.__dmSelectedPeriod;
    const month = document.getElementById("ed-sel-month");
    const year = document.getElementById("ed-sel-year");
    month.value = String(selectedMonth);
    year.value = String(selectedYear);
    month.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.token))
    .toBe(
      await page.evaluate(() => {
        const { month, year } = window.__dmSelectedPeriod;
        return `${year}-${String(month).padStart(2, "0")}`;
      }),
    );
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: month header, KPI and annual summary use one canonical bundle`, async ({
    page,
  }, testInfo) => {
    await bootConsolidatedDashboard(page, variant, testInfo);
    await clickBottomTab(page, "energy", testInfo);
    await selectPreviousMonth(page);

    await expect(page.locator("#ed-kpi-prod")).toContainText(/90(?:[,.]0)?/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/86(?:[,.]0)?/);
    await expect(page.locator("#ed-kpi-auto")).toContainText("88");
    await expect(page.locator("#ed-yoy-chips")).toContainText(/86(?:[,.]0)?/);
    await expect(page.locator("#ed-yoy-chips")).not.toContainText("107");

    await expect(page.locator("#ed-year-pagato-sub")).toContainText(/100(?:[,.]0)?/);
    await expect(page.locator("#ed-year-risparmio-sub")).toContainText(/760(?:[,.]0)?/);
    await expect(page.locator("#ed-year-pagato-sub")).not.toContainText(/(^|\D)10(?:[,.]0)?\s*kWh/i);

    await page.waitForTimeout(900);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/86(?:[,.]0)?/);
    await expect(page.locator("#ed-yoy-chips")).toContainText(/86(?:[,.]0)?/);

    const consistency = await page.evaluate(() => ({
      bundleMonth: window.__DASHBOARDMODERN_RUNTIME_0150__.bundle.month,
      bundleYear: window.__DASHBOARDMODERN_RUNTIME_0150__.bundle.year,
      metrics: window.__DASHBOARDMODERN_RUNTIME_0150__.metrics,
    }));
    expect(consistency.bundleMonth).toMatchObject({ house: 86, solar: 90, gridImport: 10 });
    expect(consistency.bundleYear).toMatchObject({ house: 760, solar: 900, gridImport: 100 });
    expect(consistency.metrics.permanentIntervals).toBe(0);
    expect(consistency.metrics.documentObservers).toBe(0);
  });

  test(`${variant}: appliance report uses total-energy deltas and UI has no duplicated rooms`, async ({
    page,
  }, testInfo) => {
    await bootConsolidatedDashboard(page, variant, testInfo);
    await clickBottomTab(page, "energy", testInfo);
    await selectPreviousMonth(page);

    await page.evaluate(async () => {
      const { month, year } = window.__dmSelectedPeriod;
      switchEnergyView?.("analysis");
      cdRebuildReportDevices?.();
      buildReportSelect?.();
      await renderEdDeviceList?.(month, year, false, 86, 10, 90);
    });

    const rows = page.locator("#ed-device-list .ed-device-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: /Frigo|Fridge/i }).locator(".ed-dev-kwh")).toContainText(/10[,.]5/);
    await expect(rows.filter({ hasText: /Scaldabagno|Water heater/i }).locator(".ed-dev-kwh")).toContainText(/2[,.]1/);
    await expect(page.locator("#ed-dev-total")).toContainText(/13[,.]1/);
    await expect(page.locator("#ed-device-list")).not.toContainText("5000");

    await clickBottomTab(page, "appliances", testInfo);
    await expect(page.locator("#page-appliances-main .dm-appliance-room-nav-0157")).toHaveCount(0);
    await expect(page.locator("#page-appliances-main").getByRole("button", { name: /Salone/i })).toHaveCount(1);
    await expect(page.locator("#page-appliances-main").getByRole("button", { name: /Terrazza/i })).toHaveCount(1);
  });

  test(`${variant}: unconfigured Wallbox and its flow lines stay absent`, async ({ page }, testInfo) => {
    await bootConsolidatedDashboard(page, variant, testInfo);
    await clickBottomTab(page, "energy", testInfo);

    const result = await page.evaluate(() => {
      window.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__.applyOptionalFlowVisibility();
      const nodes = ["", "-day", "-month"].map((suffix) => {
        const node = document.getElementById(`n-wb${suffix}`);
        return {
          exists: Boolean(node),
          hidden: node ? node.hidden || getComputedStyle(node).display === "none" : true,
        };
      });
      const lines = [...document.querySelectorAll('.flow-line[id*="wb"]')].map((line) =>
        line.hidden || getComputedStyle(line).display === "none",
      );
      return { nodes, lines };
    });

    expect(result.nodes.every((node) => node.exists && node.hidden)).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.every(Boolean)).toBe(true);
  });
}

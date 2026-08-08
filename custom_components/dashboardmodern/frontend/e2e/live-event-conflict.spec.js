import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: unrelated Home Assistant state storms trigger no expensive section work`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 100_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    // The canonical Energy bootstrap intentionally performs one Recorder load
    // for day, month and year. Do not attribute those three initial requests to
    // the unrelated state events measured below.
    await page.waitForFunction(() => {
      const root = window.__DASHBOARDMODERN_RUNTIME_ROOT__;
      return Boolean(root?.bundle?.day && root?.bundle?.month && root?.bundle?.year);
    });

    await page.evaluate(async () => {
      const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
      if (!entry?.src) throw new Error("DashboardModern module entry not found");
      const url = new URL("../src/core/runtime-metrics.js", entry.src).href;
      const { runtimeMetrics } = await import(url);
      runtimeMetrics.reset();
    });

    // Drain any RAF/microtask queued by the completed bootstrap before taking
    // the baseline. From here on, only the following unrelated events count.
    await page.waitForTimeout(250);
    const baseline = await page.evaluate(async () => {
      const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
      const { runtimeMetrics } = await import(new URL("../src/core/runtime-metrics.js", entry.src).href);
      return runtimeMetrics.snapshot();
    });

    await page.evaluate(() => {
      for (let index = 0; index < 100; index += 1) {
        window.dispatchEvent(
          new CustomEvent("dashboardmodern:state-changed", {
            detail: {
              entity_id: `sensor.unrelated_${index}`,
              entity_ids: [`sensor.unrelated_${index}`],
              state: { entity_id: `sensor.unrelated_${index}`, state: String(index) },
            },
          }),
        );
      }
    });

    await page.waitForTimeout(750);
    const after = await page.evaluate(async () => {
      const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
      const { runtimeMetrics } = await import(new URL("../src/core/runtime-metrics.js", entry.src).href);
      return runtimeMetrics.snapshot();
    });

    expect(after.recorderRequests).toBe(baseline.recorderRequests);
    expect(after.energyRefreshes).toBe(baseline.energyRefreshes);
    expect(after.applianceRenders).toBe(baseline.applianceRenders);
  });
}

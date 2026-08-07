import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

async function runtimeMetrics(page) {
  return page.evaluate(async () => {
    const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
    if (!entry?.src) throw new Error("DashboardModern module entry not found");
    const url = new URL("../src/core/runtime-metrics.js", entry.src).href;
    const module = await import(url);
    return module.runtimeMetrics;
  });
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: unrelated Home Assistant state storms trigger no expensive section work`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 100_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    await page.evaluate(async () => {
      const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
      if (!entry?.src) throw new Error("DashboardModern module entry not found");
      const url = new URL("../src/core/runtime-metrics.js", entry.src).href;
      const { runtimeMetrics } = await import(url);
      runtimeMetrics.reset();
    });

    // Allow any already queued RAF/microtask from bootstrap to drain before the
    // baseline. We are measuring work caused by the following unrelated events.
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

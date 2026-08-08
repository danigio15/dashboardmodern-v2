import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

async function runtimeSnapshot(page) {
  return page.evaluate(async () => {
    const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
    if (!entry?.src) throw new Error("DashboardModern module entry not found");
    const { runtimeMetrics } = await import(new URL("../src/core/runtime-metrics.js", entry.src).href);
    return {
      metrics: runtimeMetrics.snapshot(),
      energyRefreshPending: Boolean(window.__DASHBOARDMODERN_RUNTIME_ROOT__?.refreshTimer),
    };
  });
}

async function waitForExpensiveRuntimeQuiescence(page) {
  let previous = await runtimeSnapshot(page);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(250);
    const current = await runtimeSnapshot(page);
    const stable =
      !current.energyRefreshPending &&
      !previous.energyRefreshPending &&
      current.metrics.recorderRequests === previous.metrics.recorderRequests &&
      current.metrics.energyRefreshes === previous.metrics.energyRefreshes &&
      current.metrics.applianceRenders === previous.metrics.applianceRenders;
    if (stable) return current.metrics;
    previous = current;
  }
  throw new Error("DashboardModern runtime did not become quiescent before the live-event conflict probe");
}

async function resetRuntimeMetrics(page) {
  await page.evaluate(async () => {
    const entry = [...document.scripts].find((script) => /\/legacy\/modules-entry\.js(?:\?|$)/.test(script.src));
    if (!entry?.src) throw new Error("DashboardModern module entry not found");
    const { runtimeMetrics } = await import(new URL("../src/core/runtime-metrics.js", entry.src).href);
    runtimeMetrics.reset();
  });
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: unrelated Home Assistant state storms trigger no expensive section work`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 100_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    // The canonical Energy bootstrap intentionally performs Recorder work for
    // day, month and year. A late bootstrap/config flush may still be queued
    // after the first complete bundle, so wait for the expensive runtime to be
    // genuinely idle instead of relying on an arbitrary fixed drain delay.
    await page.waitForFunction(() => {
      const root = window.__DASHBOARDMODERN_RUNTIME_ROOT__;
      return Boolean(root?.bundle?.day && root?.bundle?.month && root?.bundle?.year);
    });
    await waitForExpensiveRuntimeQuiescence(page);
    await resetRuntimeMetrics(page);

    const baseline = (await runtimeSnapshot(page)).metrics;

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
    const after = (await runtimeSnapshot(page)).metrics;

    expect(after.recorderRequests).toBe(baseline.recorderRequests);
    expect(after.energyRefreshes).toBe(baseline.energyRefreshes);
    expect(after.applianceRenders).toBe(baseline.applianceRenders);
  });
}

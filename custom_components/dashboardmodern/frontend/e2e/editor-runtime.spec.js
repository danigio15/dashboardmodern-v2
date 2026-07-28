import { expect, test } from "@playwright/test";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: runtime, energy, loads and report use the shipped module`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    const pageErrors = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://**", async (route) => {
      const url = route.request().url();
      if (url.includes("chart.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.Chart=class{constructor(){}destroy(){}}",
        });
      if (url.includes("panzoom"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.panzoom=()=>({dispose(){}})",
        });
      if (url.includes("hls.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.Hls=class{static isSupported(){return false}}",
        });
      return route.fulfill({ status: 200, body: "" });
    });
    await page.addInitScript(() => {
      class TestSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() => {
            this.dispatchEvent(new Event("open"));
            this.onopen?.();
            this.emit({ type: "auth_required", ha_version: "test" });
          });
        }
        emit(value) {
          const event = new MessageEvent("message", { data: JSON.stringify(value) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        send(payload) {
          const message = JSON.parse(payload);
          if (message.type === "auth") this.emit({ type: "auth_ok", ha_version: "test" });
          else this.emit({ id: message.id, type: "result", success: true, result: [] });
        }
        close() {}
      }
      window.WebSocket = TestSocket;
      localStorage.setItem(
        "dm_dashboard_state",
        JSON.stringify({
          schema_version: 3,
          sections: { rooms: [], appliances: [], loads: [] },
          visibility: {},
        }),
      );
      localStorage.setItem(
        "cd_entity_overrides",
        JSON.stringify({ "dm.lavatrice_potenza_presa": "sensor.washer_power" }),
      );
    });
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(
      () => typeof window.apriConfigEntita === "function" && !!window.DashboardModernModules,
    );
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await expect(page.locator("#setup-wizard")).toHaveCount(0);
    await page.evaluate(() => {
      window.cdSyncPush = async () => {};
    });
    await page.evaluate(() => window.apriConfigEntita());
    await expect(page.locator('.ed-tab[data-tab="runtime"]')).toHaveCount(1);
    await page.locator('.ed-tab[data-tab="runtime"]').click();
    await expect(page.locator("[data-runtime-diagnostics] .ed-row")).toHaveCount(11);
    await expect(page.locator("[data-runtime-diagnostics]")).toContainText("Integration version");
    await page.evaluate(() => window.editorSwitch("sez1"));
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-energy.png` });
    const housePower = page.locator('[data-energy-panel="flows"] input').first();
    await housePower.fill("sensor.house_power");
    await housePower.blur();
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /FLUSSI ED ENTITÀ|FLOWS & ENTITIES/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /CARICHI|LOADS/ }).click();
    const loads = await page.locator('[data-energy-panel="loads"]').innerHTML();
    await page.locator("#dm-load-name").fill("Pump");
    await page.locator("#dm-load-power").fill("sensor.pump_power");
    await page.locator("#dm-load-dashboard").uncheck();
    await page.locator("[data-save-load]").click();
    await expect(
      page.locator('[data-energy-panel="loads"] [data-load-id]', { hasText: "Pump" }),
    ).toHaveCount(1);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-loads.png` });
    await page.getByRole("button", { name: "REPORT" }).click();
    const report = await page.locator('[data-energy-panel="report"]').innerHTML();
    expect(report).not.toBe(loads);
    expect(report).toMatch(/Salva Report|Save Report/);
    expect(report).not.toContain("dm-load-category");
    await page.locator("[data-report-add]").click();
    await page.locator("[data-manual-name]").fill("Manual water");
    await page.locator("#dm-manual-report-icon").fill("💧");
    await page.locator("#dm-manual-report-entity").fill("sensor.water_month");
    await page.locator("#dm-manual-report-history").fill("sensor.water_total");
    await page.locator("[data-manual-confirm]").click();
    const manual = page.locator(".dm-report-row").last();
    await expect(manual.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await expect(manual.locator(".dm-entity-picker")).toHaveCount(2);
    await expect(manual.locator(".dm-icon-picker")).toHaveCount(1);
    await expect(manual.locator("[data-report-up]")).toHaveCount(1);
    await expect(manual.locator("[data-report-down]")).toHaveCount(1);
    await expect(manual.locator("[data-report-delete]")).toHaveCount(1);
    const firstReport = page.locator(".dm-report-row").first();
    await firstReport.locator("[data-report-toggle]").check();
    await firstReport.locator("[data-report-label]").fill("Canonical label");
    await firstReport.locator("[data-entity-field] input").first().fill("sensor.canonical_month");
    await page.locator("[data-report-save]").click();
    await expect(page.locator("[data-report-actions]")).toHaveAttribute("data-state", "success");
    expect(
      await page.evaluate(
        () =>
          window.DashboardModernModules.store
            .getSection("loads")
            .find((item) => item.name === "Pump")?.show_in_dashboard,
      ),
    ).toBe(false);
    await page.getByRole("button", { name: /CARICHI|LOADS/ }).click();
    await page.getByRole("button", { name: "REPORT" }).click();
    await expect(page.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-report.png` });
    expect(
      await page.evaluate(() => {
        window.cdRebuildReportDevices();
        return ED_DEVICES.map((device) => [device.name, device.sensor]);
      }),
    ).toContainEqual(["Canonical label", "sensor.canonical_month"]);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("dm_dashboard_state")).schema_version,
      ),
    ).toBe(4);
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

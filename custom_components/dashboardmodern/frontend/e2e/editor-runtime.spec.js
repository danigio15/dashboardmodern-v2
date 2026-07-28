import { expect, test } from "@playwright/test";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: runtime, energy, loads and report use the shipped module`, async ({ page }) => {
    const errors = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.addInitScript(() => {
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
    await page.locator("[data-save-load]").click();
    await expect(
      page.locator('[data-energy-panel="loads"] [data-load-id]', { hasText: "Pump" }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "REPORT" }).click();
    const report = await page.locator('[data-energy-panel="report"]').innerHTML();
    expect(report).not.toBe(loads);
    expect(report).toMatch(/Salva Report|Save Report/);
    expect(report).not.toContain("dm-load-category");
    const firstReport = page.locator(".dm-report-row").first();
    await firstReport.locator("[data-report-toggle]").check();
    await firstReport.locator("[data-report-label]").fill("Canonical label");
    await firstReport.locator("[data-entity-field] input").first().fill("sensor.canonical_month");
    await page.locator("[data-report-save]").click();
    await expect(page.locator("[data-report-actions]")).toHaveAttribute("data-state", "success");
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
  });
}

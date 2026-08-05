import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab } from "./helpers/navigation.js";

async function openEditor(page, tab) {
  await page.evaluate((targetTab) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(targetTab);
    if (targetTab === "avvisi") window.__DASHBOARDMODERN_ALERTS_RUNTIME__?.apply?.();
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: 0.15.3 keeps Energy, appliance artwork, Lights, Alerts, EV and Temperature coherent`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 110_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          ready: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready,
          day: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.day?.house,
          month: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.month?.house,
          year: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.year?.house,
          generation: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.generation,
        })),
      )
      .toMatchObject({ ready: true, day: 5.7, month: 39.9, year: 760 });

    await expect(page.locator("#v-home-day")).toContainText(/5[,.]7/);
    await expect(page.locator("#v-solar-day")).toContainText(/7[,.]3/);
    await expect(page.locator("#v-home-month")).toContainText(/39[,.]9/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/39[,.]9/);
    const generations = await page.locator("#view-day,#view-month,#view-panoramica").evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.dmEnergyBundle),
    );
    expect(new Set(generations).size).toBe(1);
    expect(generations[0]).toBeTruthy();

    const stableSamples = await page.evaluate(async () => {
      document.getElementById("v-home-day").textContent = "614.0 kWh";
      document.getElementById("v-home-month").textContent = "614.0 kWh";
      document.getElementById("ed-kpi-cons").textContent = "614.0 kWh";
      render?.();
      const read = () => ({
        day: document.getElementById("v-home-day")?.textContent || "",
        month: document.getElementById("v-home-month")?.textContent || "",
        report: document.getElementById("ed-kpi-cons")?.textContent || "",
      });
      const samples = [];
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(read());
      await new Promise((resolve) => setTimeout(resolve, 120));
      samples.push(read());
      await new Promise((resolve) => setTimeout(resolve, 450));
      samples.push(read());
      return samples;
    });
    for (const sample of stableSamples) {
      expect(sample.day).toMatch(/5[,.]7/);
      expect(sample.month).toMatch(/39[,.]9/);
      expect(sample.report).toMatch(/39[,.]9/);
      expect(`${sample.day} ${sample.month} ${sample.report}`).not.toContain("614");
    }

    // Real regression from 0.15.2: lifetime fields vanished from the editor,
    // even though the Recorder runtime still depended on those sources.
    await openEditor(page, "sez1");
    const energyEditor = page.locator('#ed-body[data-editor="energy"]');
    await expect(energyEditor).toBeVisible();
    const totalFields = {
      "#dm-energy-house-total_energy": "sensor.house_total",
      "#dm-energy-solar-total_energy": "sensor.solar_total",
      "#dm-energy-grid-total_import_energy": "sensor.grid_import_total",
      "#dm-energy-grid-total_export_energy": "sensor.grid_export_total",
      "#dm-energy-battery-total_charged_energy": "sensor.battery_charge_total",
      "#dm-energy-battery-total_discharged_energy": "sensor.battery_discharge_total",
    };
    for (const [selector, value] of Object.entries(totalFields)) {
      const field = page.locator(selector);
      await expect(field).toBeAttached();
      await field.evaluate((node) => {
        const group = node.closest("details");
        if (group) group.open = true;
      });
      await expect(field).toBeVisible();
      await expect(field).toHaveValue(value);
    }
    await expect
      .poll(() =>
        page.evaluate(() => DashboardModernModules.store.getSection("energy")),
      )
      .toMatchObject({
        house: { total_energy: "sensor.house_total" },
        solar: { total_energy: "sensor.solar_total" },
        grid: {
          total_import_energy: "sensor.grid_import_total",
          total_export_energy: "sensor.grid_export_total",
        },
        battery: {
          total_charged_energy: "sensor.battery_charge_total",
          total_discharged_energy: "sensor.battery_discharge_total",
        },
      });

    await page.evaluate(() => {
      localStorage.setItem(
        "cd_luci",
        JSON.stringify({
          "light.salone": "Lampadario salone",
          "light.cucina": "Lampadario cucina",
          "light.pensili": "Pensili cucina",
        }),
      );
      localStorage.setItem(
        "cd_luci_rooms",
        JSON.stringify({
          "light.salone": "Salone",
          "light.cucina": "Cucina",
          "light.pensili": "Cucina",
        }),
      );
      localStorage.setItem(
        "cd_luci_room_order",
        JSON.stringify(["ROOM-VUOTA", "Salone", "Cucina"]),
      );
      localStorage.setItem(
        "cd_luci_order",
        JSON.stringify({ Cucina: ["light.pensili", "light.cucina"], "ROOM-VUOTA": [] }),
      );
      localStorage.setItem(
        "cd_avvisi_names_extra",
        JSON.stringify({
          "light.salone": "Lampadario salone",
          "light.cucina": "Lampadario cucina",
          "light.pensili": "Pensili cucina",
        }),
      );
      localStorage.setItem("cd_gruppi_extra", JSON.stringify({ luci: ["light.salone"] }));
    });

    await openEditor(page, "luci");
    const lightGroups = page.locator("#ed-body .dm-light-group");
    await expect(lightGroups).toHaveCount(2);
    await expect(page.locator('#ed-body [data-light-room="Salone"]')).toContainText("light.salone");
    const kitchen = page.locator('#ed-body [data-light-room="Cucina"]');
    await expect(kitchen).toContainText("light.pensili");
    await expect(kitchen).toContainText("light.cucina");
    await expect(page.locator("#ed-body")).not.toContainText("ROOM-VUOTA");

    await openEditor(page, "avvisi");
    await page.evaluate(() => window.__DASHBOARDMODERN_ALERTS_RUNTIME__?.apply?.());
    for (const entity of ["light.salone", "light.cucina", "light.pensili"]) {
      const row = page.locator(`[data-alert-entity="${entity}"]`);
      await expect(row).toBeVisible();
      await expect(row.locator(".ed-row-old")).toHaveText(entity);
      await expect(row.getByRole("button", { name: /Modifica|Edit/i })).toBeVisible();
    }
    await expect(page.locator("#ed-body .ed-row").filter({ hasText: /^\s*$/ })).toHaveCount(0);
    const firstAlert = page.locator('[data-alert-entity="light.cucina"]');
    await firstAlert.getByRole("button", { name: /Modifica|Edit/i }).click();
    await expect(page.locator("#ed-avv-ent")).toHaveValue("light.cucina");
    await expect(page.locator("#ed-avv-name")).toHaveValue("Lampadario cucina");

    await page.evaluate(() => {
      window.__pickedLights = null;
      cdPickLights(
        "Piano terra",
        (lights) => {
          window.__pickedLights = lights;
        },
        ["light.salone", "light.cucina"],
      );
    });
    const picker = page.locator("#dm-light-picker-0152");
    await expect(picker).toBeVisible();
    await expect(picker.locator('[data-pick-light="light.salone"]')).toBeVisible();
    await picker.locator('[data-pick-light="light.salone"] [data-down]').click();
    await picker.locator("[data-save]").click();
    await expect.poll(() => page.evaluate(() => window.__pickedLights)).toEqual([
      "light.cucina",
      "light.salone",
    ]);

    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nCEAAAAASUVORK5CYII=",
      "base64",
    );
    await page.route("**/local/auto/b10.png", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: pixel }),
    );
    await page.evaluate(() => {
      localStorage.setItem("cd_ev_image", JSON.stringify("/config/www/auto/b10.png"));
      render?.();
    });
    const vehicle = page.locator("#ev-mod-car-img");
    await expect(vehicle).toHaveAttribute("src", /\/local\/auto\/b10\.png$/);
    await expect(vehicle).toBeVisible();

    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toHaveCount(0);

    // Real regression from 0.15.2: canonical artwork was replaced by the old
    // navy line-icon tile. Verify the active overview projection, not the
    // intentionally duplicated card in the secondary-room grid.
    await clickBottomTab(page, "appliances", testInfo);
    const appliance = page.locator(
      '#appl-grid-overview .appl-wide-card[data-appliance-id="appl-fridge"]',
    );
    await expect(appliance).toBeVisible();
    await expect(appliance).toHaveAttribute("data-dm-art-style", "panel");
    await expect(appliance).toHaveAttribute("data-dm-media-kind", "asset");
    const artwork = appliance.locator(".dm-appliance-art .dm-art-panel");
    await expect(artwork).toBeVisible();
    await expect(artwork).toHaveAttribute("fill", "#e0f2fe");
    await expect(appliance.locator(".appl-visual")).toHaveCSS(
      "background-color",
      "rgb(224, 242, 254)",
    );

    await clickBottomTab(page, "temp", testInfo);
    const temperatureCard = page.locator("#temp-grid .temp-card").first();
    await expect(temperatureCard).toBeVisible();
    await expect(temperatureCard.locator(".dm-temperature-icon-fallback")).toBeVisible();
    await expect(temperatureCard).not.toContainText("🔥");
  });
}

import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab } from "./helpers/navigation.js";

async function openEditor(page, tab) {
  await page.evaluate((targetTab) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(targetTab);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: modular runtime keeps Energy, EV, appliance and editor contracts coherent`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 110_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    // An explicitly configured Home/Casa period source is authoritative for
    // day/month/year. The fixture's flow legs are deliberately inconsistent so
    // this browser contract catches any future flow-balance overwrite.
    await expect
      .poll(() =>
        page.evaluate(() => ({
          ready: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready,
          day: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.day?.house,
          month: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.month?.house,
          year: window.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.year?.house,
        })),
      )
      .toMatchObject({ ready: true, day: 5.7, month: 28.2, year: 760 });

    await expect(page.locator("#v-home-day")).toContainText(/5[,.]7/);
    await expect(page.locator("#v-home-month")).toContainText(/28[,.]2/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/28[,.]2/);
    const generations = await page.locator("#view-day,#view-month,#view-panoramica").evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.dmEnergyBundle),
    );
    expect(new Set(generations).size).toBe(1);

    const stableSamples = await page.evaluate(async () => {
      document.getElementById("v-home-month").textContent = "614.0 kWh";
      document.getElementById("ed-kpi-cons").textContent = "614.0 kWh";
      render?.();
      const read = () => ({
        month: document.getElementById("v-home-month")?.textContent || "",
        report: document.getElementById("ed-kpi-cons")?.textContent || "",
      });
      const samples = [];
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(read());
      await new Promise((resolve) => setTimeout(resolve, 500));
      samples.push(read());
      return samples;
    });
    for (const sample of stableSamples) {
      expect(sample.month).toMatch(/28[,.]2/);
      expect(sample.report).toMatch(/28[,.]2/);
      expect(`${sample.month} ${sample.report}`).not.toContain("614");
    }

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
      const nativeTotalField = field.locator("xpath=ancestor::label[@data-energy-total-field='true'][1]");
      await expect(nativeTotalField).toBeAttached();
      await expect(nativeTotalField).toContainText(
        variant.includes("-en") ? /Total energy meter/i : /Contatore energia totale/i,
      );
    }
    await expect(page.locator(".dm-energy-recorder-explanation")).toContainText(/total_increasing/);
    await expect(page.locator(".dm-energy-total-overview")).toContainText(
      variant.includes("-en") ? /previous months/i : /mesi precedenti/i,
    );
    await expect(page.locator(".dm-energy-source-guide")).toContainText(
      variant.includes("-en") ? /total kWh meter/i : /contator(?:e|i) total(?:e|i) kWh/i,
    );

    await page.evaluate(() => {
      localStorage.setItem("cd_quick_actions", JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci" }]));
      localStorage.setItem("cd_clima_units", JSON.stringify([{ type: "clima", name: "Salone", entity: "climate.salone", room: "Salone" }]));
      localStorage.setItem("cd_tapparelle", JSON.stringify([{ name: "Tapparella salone", entity: "cover.salone", room: "Salone" }]));
      const rooms = DashboardModernModules.store.getSection("rooms");
      if (!rooms.some((room) => room.id === "room-edit")) rooms.push({ id: "room-edit", name: "Studio", icon: "mdi:desk", floor: "Terra" });
      localStorage.setItem("cd_stanze", JSON.stringify(rooms));
    });

    for (const [tab, kind] of [
      ["sez8", "action"],
      ["sez9", "climate"],
      ["tapp", "shutter"],
      ["stanze", "room"],
    ]) {
      await openEditor(page, tab);
      await expect(page.locator(`#ed-body [data-dm-edit-kind="${kind}"]`).first()).toBeVisible();
    }

    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNkaPj/n4GBgYGJAQoAJRkCgp9o0gYAAAAASUVORK5CYII=",
      "base64",
    );
    await page.route("**/local/auto/b10.png", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: pixel }),
    );
    await page.evaluate(() => {
      localStorage.setItem("cd_ev_image", JSON.stringify("/loca/auto/b10.png"));
      const sections = JSON.parse(localStorage.getItem("cd_sections") || "{}");
      sections.ev = true;
      localStorage.setItem("cd_sections", JSON.stringify(sections));
      window.cdApplyNavVis?.();
      editorSwitch("sez2");
      window.dispatchEvent(new Event("pageshow"));
    });
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_ev_image"))))
      .toBe("/local/auto/b10.png");
    await page.evaluate(() => render?.());
    const vehicle = page.locator("#ev-mod-car-img");
    await expect(vehicle).toHaveAttribute("src", /\/local\/auto\/b10\.png$/);

    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toHaveCount(0);
    await clickBottomTab(page, "ev", testInfo);
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(vehicle).toBeVisible();

    await clickBottomTab(page, "appliances", testInfo);
    const appliance = page.locator(
      '#appl-grid-overview .appl-wide-card[data-appliance-id="appl-fridge"]',
    );
    await expect(appliance).toBeVisible();
    await expect(appliance).toHaveAttribute("data-dm-art-style", "panel");
    const lightAppearance = await appliance.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
    }));
    expect(lightAppearance.background).not.toBe(lightAppearance.color);

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.body.classList.add("dark");
      window.dispatchEvent(new Event("pageshow"));
    });
    await expect
      .poll(() => appliance.evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(lightAppearance.background);
    const darkAppearance = await appliance.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
    }));
    expect(darkAppearance.background).not.toBe(darkAppearance.color);

    await clickBottomTab(page, "temp", testInfo);
    const temperatureCard = page.locator("#temp-grid .temp-card").first();
    await expect(temperatureCard).toBeVisible();
    await expect(temperatureCard.locator(".temp-comfort-badge,[id^='tc_']")).toContainText(
      variant.includes("-en") ? /Cold|Cool|Comfort|Warm|Hot|Unavailable/ : /Freddo|Fresco|Comfort|Tiepido|Caldo|Non disponibile/,
    );
  });
}

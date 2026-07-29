import { expect, test } from "@playwright/test";

const devices = [
  ["washer", "Lavatrice", "lavatrice", 420, 1.8],
  ["dryer", "Asciugatrice", "asciugatrice", 780, 2.4],
  ["oven", "Forno", "forno", 1850, 3.7],
  ["fridge", "Frigorifero", "frigo", 95, 0.9],
  ["boiler", "Scaldabagno", "scaldabagno", 1200, 4.2],
].map(([id, name, type, power, energy], order) => ({
  id: `appliance-${id}`,
  name,
  device_type: type,
  visual_type: "asset",
  visual_key: type,
  room_id: "room-salone",
  power_entity: `sensor.${id}_power`,
  energy_entity: `sensor.${id}_energy`,
  history_entity: `sensor.${id}_energy`,
  entities: [`sensor.${id}_power`, `sensor.${id}_energy`],
  show_in_report: true,
  report_icon: type === "forno" ? "♨️" : "⚡",
  report_order: order,
  _power: power,
  _energy: energy,
}));

async function boot(page) {
  await page.route("https://**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.Chart=class{static defaults={color:'',font:{}};constructor(){}destroy(){}};window.panzoom=()=>({dispose(){}})",
    }),
  );
  await page.addInitScript(() => {
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.onopen?.());
      }
      send(p) {
        const m = JSON.parse(p);
        queueMicrotask(() =>
          this.onmessage?.(
            new MessageEvent("message", {
              data: JSON.stringify(
                m.type === "auth"
                  ? { type: "auth_ok" }
                  : { id: m.id, type: "result", success: true, result: [] },
              ),
            }),
          ),
        );
      }
      close() {}
    };
  });
  await page.goto("/legacy/dashboard.html");
  await page.evaluate(
    ({ devices }) => {
      localStorage.clear();
      localStorage.setItem(
        "dm_dashboard_state",
        JSON.stringify({
          schema_version: 4,
          sections: {
            rooms: [{ id: "room-salone", name: "Salone", icon: "🏠" }],
            appliances: devices.map(({ _power, _energy, ...d }) => d),
            loads: [],
            lights: [],
            entityOverrides: {},
          },
          visibility: {},
        }),
      );
    },
    { devices },
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((n) => n.remove()));
  await page.evaluate((devices) => {
    devices.forEach((d) => {
      STATES[d.power_entity] = {
        state: String(d._power),
        attributes: { unit_of_measurement: "W", friendly_name: d.name + " potenza" },
      };
      STATES[d.energy_entity] = {
        state: String(d._energy),
        attributes: { unit_of_measurement: "kWh", friendly_name: d.name + " energia" },
      };
    });
    cdRebuildReportDevices();
    buildReportSelect();
  }, devices);
}

test("release evidence", async ({ page }, info) => {
  await boot(page);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-appliances-main").classList.add("active");
    renderApplianceSection(true);
  });
  await expect(page.locator("#appl-grid-overview .dm-control-device")).toHaveCount(5);
  expect(
    await page.locator("#page-appliances-main").evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
  ).toBe(true);
  const dir = "docs/screenshots";
  await page.screenshot({ path: `${dir}/appliances-${info.project.name}.png`, fullPage: true });
  if (info.project.name !== "mobile") return;
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_tapparelle",
      JSON.stringify([{ name: "Salone", entity: "cover.salone" }]),
    );
    STATES["cover.salone"] = { state: "open", attributes: {} };
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-home").classList.add("active");
  });
  await expect(page.locator("#tapp-avvisi .glance-card")).toContainText("1 tapparella aperta", {
    timeout: 3000,
  });
  await page.screenshot({ path: `${dir}/home-mobile-shutter-alert.png`, fullPage: true });
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-energy").classList.add("active");
    document.getElementById("ed-pane-analisi").style.display = "block";
    document.getElementById("ed-pane-panoramica").style.display = "none";
    buildReportSelect();
  });
  await expect(page.locator("#ed-dev-selector")).toContainText("Forno");
  await page.screenshot({ path: `${dir}/energy-analysis-mobile-forno.png`, fullPage: true });
  await page.selectOption("#ed-dev-selector", "sensor.oven_energy");
  await page.evaluate(() => window.edCaricaDettaglio?.());
  await page
    .locator(".ed-dev-detail-wrap")
    .screenshot({ path: `${dir}/energy-device-detail-mobile-forno.png` });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("luci");
  });
  await expect(page.locator(".dm-light-add-form .dm-entity-picker")).toBeVisible();
  await page.screenshot({ path: `${dir}/lights-editor-mobile.png`, fullPage: true });
});

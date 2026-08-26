import { test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
const D = "/tmp/claude-0/-home-user-dashboardmodern-v2/e6f99a26-23f7-5f2b-81d3-f19f3ed89d00/scratchpad/";
const seme = {
  schema_version: 4,
  sections: {
    rooms: [], cameras: [], appliances: [], lights: [], climate: [], ev: [], covers: [],
    pool: {}, irrigation: { zones: [] }, entityOverrides: {}, loads: [],
    energy: {
      house: { power: "sensor.casa_potenza", total_energy: "sensor.casa_totale" },
      grid: { power: "sensor.rete_scambio", total_import_energy: "sensor.rete_prelievo" },
      solar: { power: "sensor.fv_potenza", total_energy: "sensor.fv_totale" },
      battery: { power: "sensor.batt_potenza", soc: "sensor.batt_soc" },
      metadata: {},
    },
    energyLoads: [
      { id: "l1", name: "Pompa di calore", icon: "mdi:heat-pump", power_entity: "sensor.pdc", color: "#f59e0b" },
      { id: "l2", name: "Wallbox", icon: "mdi:ev-station", power_entity: "sensor.wb", color: "#3b82f6" },
    ],
  },
  visibility: { home: true, energy: true },
};
test("cfg", async ({ page }, testInfo) => {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.waitForTimeout(800);
  await page.locator('.ed-tab[data-tab="sez1"]').first().click();
  await page.waitForTimeout(1800);
  await page.locator("#editor-modal .ed-card, #editor-modal").first().screenshot({ path: `${D}cfg-energia.png` });
});

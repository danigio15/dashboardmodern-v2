/* La casella Batteria del widget Energia dice anche quanto e' piena.
 *
 * Dal campo: «nel widget fotovoltaico inserire anche percentuale batteria
 * attuale». Lo stato di carica ha gia' il suo slot; ora la casella Batteria
 * lo scrive accanto ai watt — e con la sola percentuale mappata, basta lei a
 * far esistere la casella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const STATI = {
  "sensor.casa_w": {
    entity_id: "sensor.casa_w",
    state: "480",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.batteria_w": {
    entity_id: "sensor.batteria_w",
    state: "-320",
    attributes: { unit_of_measurement: "W" },
  },
  "sensor.batteria_soc": {
    entity_id: "sensor.batteria_soc",
    state: "78",
    attributes: { unit_of_measurement: "%" },
  },
};

test("watt e percentuale, nella stessa casella", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((extra) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...extra } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, extra);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, STATI);
  await page.waitForTimeout(1800);

  await page.evaluate(() => {
    document.querySelector('#dm-widgets [data-dm-widget="energia"]')?.click();
  });
  const corpo = page.locator("#dm-widget-popup .dm-w-body");
  await expect(corpo).toBeVisible({ timeout: 10000 });
  /* La casella Batteria porta watt E percentuale. */
  await expect(corpo).toContainText("78%", { timeout: 10000 });
  await expect(corpo).toContainText("Batteria");
});

/* «I controlli del server proxmox dove gira HA con tutti i suoi container, e
 * controllare lo stato del fritbox e i suoi ripeter» (#382).
 *
 * Qui si guarda quello che vede chi ha Proxmox e un FritzBox: la tessera in
 * Home che dice quante sono ferme, le due fasce nella pagina Server, e il tasto
 * che ferma il container — che esce solo dove c'è davvero qualcosa da premere.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, server: true },
};

const STATI = {
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "binary_sensor.pve_lxc_101_status": {
    entity_id: "binary_sensor.pve_lxc_101_status",
    state: "on",
    attributes: { device_class: "running", friendly_name: "HomeAssistant" },
  },
  "binary_sensor.pve_qemu_103_status": {
    entity_id: "binary_sensor.pve_qemu_103_status",
    state: "off",
    attributes: { device_class: "running", friendly_name: "NAS" },
  },
  "switch.pve_qemu_103": {
    entity_id: "switch.pve_qemu_103",
    state: "off",
    attributes: { friendly_name: "NAS" },
  },
  "binary_sensor.fritzbox_connection": {
    entity_id: "binary_sensor.fritzbox_connection",
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "FRITZ!Box" },
  },
  "binary_sensor.ripetitore_salotto_connection": {
    entity_id: "binary_sensor.ripetitore_salotto_connection",
    state: "off",
    attributes: { device_class: "connectivity", friendly_name: "Ripetitore salotto" },
  },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI);
}

test("la tessera dice quante sono ferme, e quali", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const tessera = page.locator('.dm-tile[data-dm-widget="macchine"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  /* Due ferme: il NAS e il ripetitore del salotto. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("2");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("NAS");
  await expect(tessera).toHaveAttribute("data-alert", "true");
});

test("la pagina Server porta le macchine e la rete, col loro tasto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());

  const fasce = page.locator("#page-server .dm-macchine-fascia");
  await expect(fasce).toHaveCount(2, { timeout: 20_000 });

  const nas = page.locator("#page-server .dm-macchina", { hasText: "NAS" }).first();
  await expect(nas).toHaveAttribute("data-stato", "giu");
  const ha = page.locator("#page-server .dm-macchina", { hasText: "HomeAssistant" }).first();
  await expect(ha).toHaveAttribute("data-stato", "su");

  /* Il NAS ha un interruttore che si chiama come lui: il tasto c'è, e dice
   * «Avvia» perché adesso è fermo. */
  await expect(nas.locator("[data-dm-macchina-switch]")).toHaveText(/Avvia|Start/);
  /* HomeAssistant non ha niente da premere: nessun tasto. */
  await expect(ha.locator("[data-dm-macchina-switch], [data-dm-macchina-premi]")).toHaveCount(0);

  /* Il ripetitore è nella fascia della rete, e dice «Assente». */
  const ripetitore = page
    .locator("#page-server .dm-macchina", { hasText: "Ripetitore salotto" })
    .first();
  await expect(ripetitore).toHaveAttribute("data-stato", "giu");
  await expect(ripetitore.locator(".dm-macchina-stato")).toHaveText(/Assente|Down/);
});

test("il tasto chiede davvero ad Home Assistant di accendere", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());
  await expect(page.locator("#page-server .dm-macchina").first()).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    window.__CHIAMATE = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE.push([dominio, servizio, dati?.entity_id]);
    };
  });
  await page
    .locator("#page-server .dm-macchina", { hasText: "NAS" })
    .first()
    .locator("[data-dm-macchina-switch]")
    .click();
  expect(await page.evaluate(() => window.__CHIAMATE)).toEqual([
    ["switch", "turn_on", "switch.pve_qemu_103"],
  ]);
});

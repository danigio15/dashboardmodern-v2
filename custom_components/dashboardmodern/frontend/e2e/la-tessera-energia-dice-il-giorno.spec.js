/* «Oltre ai dati del consumo attuale istantaneo inserirei, sotto in basso in
 *  piccolino, anche quelli della produzione, importazione ecc. del giorno. Per
 *  avere il colpo d'occhio necessario.» (#429)
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w", daily_energy: "sensor.casa_oggi" },
      solar: { power: "sensor.pv_w", daily_energy: "sensor.pv_oggi" },
      grid: {
        power: "sensor.rete_w",
        daily_import_energy: "sensor.prelievo_oggi",
        daily_export_energy: "sensor.immissione_oggi",
      },
      battery: {
        power: "sensor.batt_w",
        soc: "sensor.batt_soc",
        daily_charged_energy: "sensor.batt_carica_oggi",
        daily_discharged_energy: "sensor.batt_scarica_oggi",
      },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const kwh = (valore) => ({ state: String(valore), attributes: { unit_of_measurement: "kWh" } });
const watt = (valore) => ({ state: String(valore), attributes: { unit_of_measurement: "W" } });
const STATI = {
  "sensor.casa_w": watt(820),
  "sensor.pv_w": watt(1540),
  "sensor.rete_w": watt(-720),
  "sensor.batt_w": watt(-160),
  "sensor.batt_soc": { state: "74", attributes: { unit_of_measurement: "%" } },
  "sensor.casa_oggi": kwh(12.34),
  "sensor.pv_oggi": kwh(8.12),
  "sensor.prelievo_oggi": kwh(5.2),
  "sensor.immissione_oggi": kwh(2.44),
  "sensor.batt_carica_oggi": kwh(3.6),
  "sensor.batt_scarica_oggi": kwh(1.9),
};

test("la tessera dice il giorno, e aprendola ogni sorgente dice il suo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((stati) => {
    const raw = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const [id, voce] of Object.entries(stati)) {
      const stato = { entity_id: id, ...voce };
      if (raw) raw[id] = stato;
      if (typeof STATES !== "undefined") STATES[id] = stato;
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="energia"]').first();
  await expect(tessera).toBeVisible();
  // Il numero grande resta la potenza di adesso.
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("820");
  // Sotto, in piccolo, com'e' andato il giorno.
  const didascalia = tessera.locator("[data-dm-tile-caption]");
  await expect(didascalia).toContainText("Oggi 12,3 kWh");
  await expect(didascalia).toContainText("Produzione 8,1");
  await expect(didascalia).toContainText("Prelievo 5,2");
  await expect(didascalia).toContainText("Immissione 2,4");
  /* Quattro numeri in una tessera non ci stanno fermi, e la plancia per questo
   * ha il nastro che scorre — le Luci ci elencano quali sono accese. Qui si
   * pretende che sia acceso: senza, la coda della riga non si leggerebbe mai. */
  await expect
    .poll(() => didascalia.getAttribute("data-dm-scroll"), { timeout: 8000 })
    .toBe("true");
  await testInfo.attach("tessera-energia", {
    body: await tessera.screenshot(),
    contentType: "image/png",
  });

  // E aprendola, ogni sorgente porta il suo numero del giorno sotto la potenza.
  await tessera.evaluate((nodo) => nodo.click());
  const dettaglio = page.locator('[data-dm-widget-detail="energia"]').first();
  await expect(dettaglio).toBeVisible();
  // Nella finestra le parole si scrivono per esteso: c'e' lo spazio.
  await expect(dettaglio).toContainText("Oggi · Produzione 8,1 kWh");
  // La rete ha due versi: preso e dato, sulla stessa riga.
  await expect(dettaglio).toContainText("Oggi · Prelievo 5,2 kWh · Immissione 2,4 kWh");
  await expect(dettaglio).toContainText("In batteria 3,6 kWh · Da batteria 1,9 kWh");
  await testInfo.attach("dettaglio-energia", {
    body: await dettaglio.screenshot(),
    contentType: "image/png",
  });
});

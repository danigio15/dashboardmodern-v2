/* Il contatore totale comanda, e la maschera lo dice.
 *
 * Chi riempie il totale e anche giornaliera, mensile e annuale si ritrova due
 * verita' che non tornano. Ora ogni periodo si ricava dal totale con Recorder e
 * i campi di periodo restano fuori dal modello — ma la configurazione resta
 * scritta, quindi la maschera Energia deve dire per nome quali entita' sta
 * scavalcando, e offrire di svuotarle.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const energy = {
  house: {
    total_energy: "sensor.casa_totale",
    daily_energy: "sensor.casa_giorno",
    monthly_energy: "sensor.casa_mese",
    annual_energy: "sensor.casa_anno",
  },
};

const seed = {
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
    energy,
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { energy: true },
};

async function openEnergyEditor(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    const tab = [...document.querySelectorAll("#editor-modal .ed-tab")].find((node) =>
      /energ/i.test(node.textContent),
    );
    tab?.click();
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: the energy editor names the fields the total meter overrides`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await bootNamespacedDashboard(page, variant, testInfo, seed);

    // The dashboard only knows an entity exists if Home Assistant reports it.
    await page.evaluate(() => {
      const states =
        window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
        window._RAW_STATES;
      for (const id of [
        "sensor.casa_totale",
        "sensor.casa_giorno",
        "sensor.casa_mese",
        "sensor.casa_anno",
      ]) {
        states[id] = {
          entity_id: id,
          state: "10",
          attributes: {
            unit_of_measurement: "kWh",
            device_class: "energy",
            state_class: "total_increasing",
          },
        };
      }
    });

    await openEnergyEditor(page);
    const clash = page.locator("#editor-modal .dm-energy-source-clash");
    await expect(clash).toBeVisible();
    // By name, so nobody has to guess which value stopped being read.
    await expect(clash).toContainText("sensor.casa_totale");
    await expect(clash).toContainText("sensor.casa_giorno");
    await expect(clash).toContainText("sensor.casa_mese");
    await expect(clash).toContainText("sensor.casa_anno");

    // La scheda "come leggere la configurazione" e' scritta da un altro modulo:
    // deve dire la stessa cosa, o le due si contraddicono a vista.
    await expect(page.locator("#editor-modal .dm-energy-guide-steps")).toContainText(
      /contatore totale/i,
    );

    await clash.locator(".dm-energy-clash-clear").click();

    // The button empties exactly those fields, and the warning goes with them.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const house = DashboardModernModules.store.getSection("energy")?.house || {};
          return [house.total_energy, house.daily_energy, house.monthly_energy, house.annual_energy];
        }),
      )
      .toEqual(["sensor.casa_totale", "", "", ""]);
    await expect(page.locator("#editor-modal .dm-energy-source-clash")).toHaveCount(0);
  });
}

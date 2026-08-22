/* Una voce che entra deve poter uscire.
 *
 * L'elenco degli avvisi lo stampa il runtime da una mappa di gruppi scritta a
 * mano che si ferma ai suoi cinque: un allagamento salvato contava nel quadro e
 * si apriva nel popup, ma dalla configurazione spariva — non si poteva piu'
 * rinominare, e soprattutto non si poteva piu' togliere.
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "binary_sensor.perdita_lavanderia": {
    entity_id: "binary_sensor.perdita_lavanderia",
    state: "on",
    attributes: { device_class: "moisture", friendly_name: "Perdita lavanderia" },
  },
  "binary_sensor.perdita_caldaia": {
    entity_id: "binary_sensor.perdita_caldaia",
    state: "off",
    attributes: { device_class: "moisture", friendly_name: "Locale caldaia" },
  },
};

async function apriAvvisi(page) {
  await page.evaluate(() => {
    globalThis.apriConfigEntita?.();
    globalThis.editorSwitch?.("avvisi");
  });
}

test("l'allagamento si vede in configurazione e si puo' togliere", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);

  await apriAvvisi(page);

  // La fisarmonica degli allagamenti c'e', con dentro i due sensori rilevati.
  const acc = page.locator("[data-dm-flood-acc]");
  await expect(acc).toHaveCount(1, { timeout: 20_000 });
  await expect(acc.locator("[data-dm-flood-row]")).toHaveCount(2);
  await expect(acc).toContainText("Perdita lavanderia");
  await expect(acc).toContainText("Locale caldaia");

  // Il gruppo si sceglie anche quando se ne aggiunge uno a mano.
  await expect(page.locator('#ed-avv-grp option[value="allag"]')).toHaveCount(1);

  // Il cestino toglie davvero, e quello che si toglie resta tolto. La
  // fisarmonica nasce chiusa come tutte le altre: prima si apre.
  await acc.locator("summary").click();
  await acc.locator('[data-dm-flood-del="binary_sensor.perdita_caldaia"]').click();
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-flood-row]")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("[data-dm-flood-acc]")).not.toContainText("Locale caldaia");

  // E resta tolto anche ricaricando: non torna al giro dopo.
  await page.reload();
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-flood-row]")).toHaveCount(1, { timeout: 20_000 });
});

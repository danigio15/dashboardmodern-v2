/* «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento.» (#367)
 *
 * In configurazione un contatto porta-finestra e' un campo con dentro un
 * entity_id: dice come si chiama, non come sta. La pastiglia non appartiene a
 * una scheda sola — la domanda «questa e' aperta?» e' la stessa dovunque la si
 * faccia — quindi qui si prova sul campo, che e' la forma in cui un contatto
 * compare in ogni scheda della configurazione.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STATI = {
  "binary_sensor.finestra_cucina": {
    entity_id: "binary_sensor.finestra_cucina",
    state: "on",
    attributes: { device_class: "window", friendly_name: "Finestra cucina" },
  },
  "binary_sensor.movimento_salotto": {
    entity_id: "binary_sensor.movimento_salotto",
    state: "on",
    attributes: { device_class: "motion", friendly_name: "Movimento salotto" },
  },
};

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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

/* Una riga di configurazione come le disegna la plancia: l'etichetta, il campo
 * con l'entita' dentro, la lente accanto. */
async function rigaConUnContatto(page, entity) {
  await page.evaluate((id) => {
    document.getElementById("dm-prova-varco")?.remove();
    const corpo = document.getElementById("ed-body");
    const riga = document.createElement("label");
    riga.id = "dm-prova-varco";
    riga.className = "ed-slot";
    riga.innerHTML =
      '<span class="ed-slot-lbl">Sensore apertura infisso</span>' +
      '<span class="ed-form-row"><input class="ed-input mono" data-entity-input="true" value="' +
      id +
      '"><button type="button" class="dm-entity-picker">🔍</button></span>';
    corpo.prepend(riga);
    globalThis.render?.();
  }, entity);
}

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((stati) => {
    Object.assign(_RAW_STATES, stati);
    Object.assign(STATES, stati);
    globalThis.apriConfigEntita?.();
  }, STATI);
}

test("una finestra aperta si vede rossa senza uscire dalla configurazione", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await rigaConUnContatto(page, "binary_sensor.finestra_cucina");
  const pastiglia = page.locator("#dm-prova-varco .dm-varco-pastiglia");
  await expect(pastiglia).toHaveAttribute("data-varco", "aperto");
  await expect(pastiglia).toHaveText(/Aperta|Open/i);
});

test("chiudendola diventa verde da sola, senza cambiare scheda", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await rigaConUnContatto(page, "binary_sensor.finestra_cucina");
  await expect(page.locator("#dm-prova-varco .dm-varco-pastiglia")).toHaveAttribute(
    "data-varco",
    "aperto",
  );
  await page.evaluate(() => {
    _RAW_STATES["binary_sensor.finestra_cucina"].state = "off";
    STATES["binary_sensor.finestra_cucina"].state = "off";
    globalThis.render?.();
  });
  await expect(page.locator("#dm-prova-varco .dm-varco-pastiglia")).toHaveAttribute(
    "data-varco",
    "chiuso",
  );
});

test("un sensore che non e' un varco non si colora", async ({ page }, testInfo) => {
  /* Un rilevatore di movimento sta a ON come una finestra aperta, e non e' una
   * finestra: colorarlo rosso direbbe una cosa falsa. */
  await avvia(page, testInfo);
  await rigaConUnContatto(page, "binary_sensor.movimento_salotto");
  await expect(page.locator("#dm-prova-varco .dm-varco-pastiglia")).toHaveCount(0);
});

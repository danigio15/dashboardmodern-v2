/* Tre segnalazioni arrivate dalla plancia vera, ognuna guardata dove succede.
 *
 * #378 — «Ho un cancelletto che si apre tramite un sonoff mini d, ma quando
 * cerco di inserire l'entità switch.sonoff_100253b430_1 non viene salvata.»
 * Si salvava: era il ridisegno subito dopo a cancellarla, perché quello stesso
 * interruttore stava anche fra le Prese.
 *
 * #379 — «Una stanza mostra una misura di umidità pur non essendoci nessun
 * sensore associato.» Non c'era nessun sensore: c'era il termometro, letto una
 * seconda volta e stampato col «%» addosso.
 *
 * #381 — «Alcune icone negli avvisi personalizzati non vengono visualizzate
 * correttamente, sia in config che nel widget.» Erano nomi mdi stampati come
 * testo: si leggeva il nome invece di vedersi il disegno.
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
  visibility: { home: true, security: true, porte: true },
};

const STANZE = [
  { id: "camera", name: "Camera da letto", temp: "sensor.camera_temp" },
  {
    id: "salotto",
    name: "Salotto",
    temp: "sensor.salotto_temperature",
    hum: "sensor.salotto_humidity",
  },
];

const STATI = {
  "sensor.camera_temp": {
    entity_id: "sensor.camera_temp",
    state: "19.4",
    attributes: {
      friendly_name: "Camera temp",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  "sensor.salotto_temperature": {
    entity_id: "sensor.salotto_temperature",
    state: "21.8",
    attributes: {
      friendly_name: "Salotto temperatura",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  "sensor.salotto_humidity": {
    entity_id: "sensor.salotto_humidity",
    state: "48",
    attributes: {
      friendly_name: "Salotto umidità",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  "binary_sensor.perdita_caldaia": {
    entity_id: "binary_sensor.perdita_caldaia",
    state: "on",
    attributes: { friendly_name: "Perdita caldaia", device_class: "moisture" },
  },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

async function conStati(page, valori) {
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, valori);
}

test("un rele' che e' anche una presa si salva come apertura (#378)", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Lo stesso interruttore sta già fra le Prese: è un Sonoff, ed è il caso
   * della segnalazione. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_prese",
      JSON.stringify([{ id: "p1", name: "Sonoff", entity: "switch.sonoff_100253b430_1" }]),
    );
  });

  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-add]")).toBeAttached({ timeout: 20_000 });
  await page.locator("[data-door-add]").click();

  await page.evaluate(() => {
    document.getElementById("dm-door-0-name").value = "Cancelletto";
    const campo = document.getElementById("dm-door-0-entity");
    campo.value = "switch.sonoff_100253b430_1";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator(".dm-save-footer-btn").click();

  /* Prima la riga spariva qui: il ridisegno la scartava perché quell'entità
   * era anche una presa, e riscriveva la lista salvata senza. */
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          JSON.parse(window.localStorage.getItem("cd_security_doors") || "[]").map(
            (porta) => porta.entity,
          ),
        ),
      { timeout: 10_000 },
    )
    .toEqual(["switch.sonoff_100253b430_1"]);
  await expect(page.locator("[data-door-index]")).toHaveCount(1);
});

test("l'umidita' non si inventa dal termometro (#379)", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate((stanze) => {
    window.localStorage.setItem("cd_stanze", JSON.stringify(stanze));
  }, STANZE);
  await conStati(page, STATI);
  await page.evaluate(() => window.renderHomeWidgets?.());

  const tessera = page.locator('.dm-tile[data-dm-widget="temperatura"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.click();

  const camera = page.locator(".dm-w-casella", { hasText: "Camera da letto" }).first();
  const salotto = page.locator(".dm-w-casella", { hasText: "Salotto" }).first();
  await expect(camera).toBeVisible({ timeout: 10_000 });
  /* La camera ha solo il termometro: nessuna goccia, e nessun numero preso in
   * prestito dai gradi — prima diceva «💧 19%», che erano i gradi. */
  await expect(camera).not.toContainText("💧");
  /* Il salotto l'umidità ce l'ha davvero, e continua a vedersi. */
  await expect(salotto).toContainText("💧 48%");
});

test("l'icona di un avviso personalizzato si disegna (#381)", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_avvisi_custom",
      JSON.stringify([
        {
          name: "Perdita caldaia",
          entities: ["binary_sensor.perdita_caldaia"],
          icon: "mdi:water",
          cond: "eq",
          value: "on",
        },
      ]),
    );
  });
  await conStati(page, STATI);
  await page.evaluate(() => window.renderHomeWidgets?.());

  /* La tessera dell'avviso che uno si e' scritto: la sua faccia e' l'icona
   * scelta dal catalogo, e un nome mdi non si legge — si disegna. */
  const tessera = page.locator('.dm-tile[data-dm-widget="custom-0"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  const faccia = tessera.locator(".dm-tile-chip").first();
  await expect(faccia).not.toContainText("mdi:");
  expect(
    await faccia.evaluate((nodo) => Boolean(nodo.querySelector("[data-dm-icon-engine-glyph]"))),
  ).toBe(true);

  /* E in configurazione, nell'elenco del Quadro Avvisi, vale lo stesso: li'
   * la riga la scrive il guscio, e stampava il nome com'era scritto. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("avvisi"));
  const riga = page
    .locator("#editor-modal .ed-acc .ed-row", { hasText: "Perdita caldaia" })
    .first();
  await expect(riga).toBeVisible({ timeout: 20_000 });
  await expect(riga).not.toContainText("mdi:");
});

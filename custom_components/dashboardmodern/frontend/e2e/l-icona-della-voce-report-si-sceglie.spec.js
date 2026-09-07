/* «Modifica voce Report»: l'icona si sceglie dal catalogo di casa.
 *
 * La finestra che apre la riga del Report chiedeva l'icona con una casella di
 * testo nuda: per cambiarla bisognava sapere a memoria il nome di un disegno
 * (`mdi:...`) o incollarci dentro un'emoji. Era l'ultima casella della
 * configurazione rimasta senza il suo catalogo.
 *
 * Qui si tocca il riquadro come lo tocca un dito: il catalogo deve comparire —
 * quello delle icone, non la ricerca delle entita' — si deve poter scegliere,
 * e la scelta deve restare scritta nella casella e nella riga che si salva.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "app-lavastoviglie",
        name: "Lavastoviglie",
        device_type: "lavastoviglie",
        total_energy_entity: "sensor.lavastoviglie_energia",
        entities: ["sensor.lavastoviglie_energia"],
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { name: "Casa", grid: { power: "sensor.rete_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

async function apriIlReport(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("energy");
    } catch (_errore) {}
  });
  const linguetta = page
    .locator("#editor-modal .ed-inner-tab")
    .filter({ hasText: /REPORT/i })
    .first();
  await linguetta.waitFor({ state: "visible", timeout: 20_000 });
  await linguetta.click();
  await expect(page.locator('#editor-modal [data-energy-panel="report"]')).toBeVisible({
    timeout: 20_000,
  });
}

test("il riquadro dell'icona apre il catalogo, e la scelta resta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Il contatore della lavastoviglie e' un totale di vita: senza questo la
   * finestra rifiuta il salvataggio e non si vedrebbe dove va a finire la
   * scelta. Gli stati del guscio sono variabili lessicali, non roba di
   * `window`: si scrivono per nome, come fa ogni altra prova. */
  await page.evaluate(() => {
    const voce = {
      entity_id: "sensor.lavastoviglie_energia",
      state: "12.5",
      attributes: {
        friendly_name: "Lavastoviglie energia",
        unit_of_measurement: "kWh",
        device_class: "energy",
        state_class: "total_increasing",
      },
    };
    _RAW_STATES[voce.entity_id] = structuredClone(voce);
    STATES[voce.entity_id] = structuredClone(voce);
  });
  await apriIlReport(page);

  /* La riga si apre per intero col suo tasto: e' li' che sta la casella
   * dell'icona di questa voce. */
  const riga = page.locator("#editor-modal .dm-report-row").first();
  await expect(riga).toBeVisible({ timeout: 20_000 });
  await riga.locator("[data-dm-report-edit]").click();

  const finestra = page.locator("#dm-report-row-editor");
  await expect(finestra).toBeVisible({ timeout: 10_000 });

  const riquadro = finestra.locator("[data-dm-report-icona]");
  await expect(riquadro).toBeVisible({ timeout: 10_000 });
  /* Niente lo copre: se qualcosa gli sta sopra, il dito non lo trova mai. */
  const sotto = await riquadro.evaluate((nodo) => {
    const r = nodo.getBoundingClientRect();
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { suo: nodo.contains(centro), chi: centro?.tagName?.toLowerCase() || "(niente)" };
  });
  expect(sotto.suo, `sopra il riquadro c'e' ${sotto.chi}`).toBe(true);

  await riquadro.click({ timeout: 10_000 });

  /* Il catalogo delle icone, non la ricerca delle entita': la casella accanto
   * accetta un disegno, non un entity_id. */
  const catalogo = page.locator("#dm-visual-picker");
  await expect(catalogo).toBeVisible({ timeout: 10_000 });
  await expect(catalogo).toHaveAttribute("data-kind", "action");
  await expect(page.locator("#cd-entpick")).toHaveCount(0);

  await catalogo.locator(".dm-picker-option").first().click();
  await expect(catalogo).toHaveCount(0);

  const casella = finestra.locator('input[name="icon"]');
  await expect(casella).toHaveValue(/.+/);
  const scelta = await casella.inputValue();

  /* E la scelta arriva fino alla riga della configurazione, che e' quella che
   * si salva. */
  await finestra.locator('button[type="submit"]').click();
  await expect(finestra).toHaveCount(0);
  await expect(riga.locator(".dm-icon-field input,.ed-icon-input").first()).toHaveValue(scelta);
});

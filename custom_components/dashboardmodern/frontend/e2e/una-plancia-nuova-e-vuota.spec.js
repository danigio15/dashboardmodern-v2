/* Una plancia appena creata non racconta la casa di un'altra.
 *
 * Dal campo, con lo scatto della plancia nuova: «ho provato a cambiare nome,
 * effettivamente l'ha ritirata bene, ma erano presenti aperture». Sotto il
 * messaggio «non hai ancora collegato le tue entita', quindi le card sono
 * nascoste» compariva il ponte con «APERTURE 2», e dentro «2 aperte su 30» —
 * tutte le finestre della casa, che questa plancia non ha mai configurato.
 *
 * Le tessere degli avvisi nascono dal rilevamento, non dalla configurazione:
 * finche' qui non c'e' niente di configurato, il ponte tace.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const VUOTA = {
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
  "binary_sensor.bagno_finestra": {
    state: "on",
    attributes: { friendly_name: "Termosifone Bagno Stato finestra" },
  },
  "binary_sensor.bagno_piccolo_porta": {
    state: "on",
    attributes: { friendly_name: "Sensore Finestra Bagno Piccolo Porta" },
  },
  "binary_sensor.cucina_finestra": {
    state: "off",
    attributes: { friendly_name: "Termosifone cucina Stato finestra" },
  },
};

/* La casa vista da Home Assistant: le aperture le trova il rilevamento, e
 * questa plancia non ne ha configurata nessuna. */
async function laCasaEsiste(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.eval(
      "try{ GRUPPI_MONITORAGGIO.win = ['binary_sensor.bagno_finestra','binary_sensor.bagno_piccolo_porta','binary_sensor.cucina_finestra']; }catch(e){}",
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI);
  await page.waitForTimeout(1200);
}

test("una plancia senza configurazione non mostra il ponte dei widget", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, VUOTA);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await laCasaEsiste(page);

  await expect(page.locator("#dm-widgets")).toHaveCount(0);
  await expect(page.locator('.dm-tile[data-dm-widget="aperture"]')).toHaveCount(0);
});

test("basta una stanza perche' il ponte torni", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, VUOTA);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await laCasaEsiste(page);
  await expect(page.locator("#dm-widgets")).toHaveCount(0);

  /* Si configura qualcosa — una stanza, la prima cosa che chiunque fa — e la
   * plancia ricomincia a raccontare quello che ha in casa. */
  await page.evaluate(async () => {
    /* Una stanza appena creata, col solo nome: e' come nasce dall'editor, e
     * i sensori si aggiungono dopo. Chiesto in revisione: il ponte deve
     * tornare gia' adesso, non solo quando la stanza ha una temperatura. */
    await window.DashboardModernModules?.store?.replaceSection?.("rooms", [
      { id: "bagno", name: "Bagno" },
    ]);
  });
  await laCasaEsiste(page);
  await expect(page.locator('.dm-tile[data-dm-widget="aperture"]')).toHaveCount(1, {
    timeout: 20_000,
  });
});

test("le pillole delle aperture portano il disegno di casa, non l'emoji del telefono", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...VUOTA,
    sections: {
      ...VUOTA.sections,
      rooms: [{ id: "bagno", name: "Bagno", temp: "sensor.bagno_t" }],
    },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await laCasaEsiste(page);

  const tessera = page.locator('.dm-tile[data-dm-widget="aperture"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.click();

  const pillole = page.locator(".dm-w-pillola");
  await expect(pillole.first()).toBeVisible({ timeout: 20_000 });
  const segni = await page.evaluate(() =>
    [...document.querySelectorAll(".dm-w-pillola-ic")].slice(0, 6).map((segno) => ({
      disegno: Boolean(segno.querySelector("svg")),
      testo: (segno.textContent || "").trim(),
    })),
  );
  expect(segni.length).toBeGreaterThan(0);
  /* Ogni pillola porta il suo disegno, e nessuna porta piu' un carattere di
   * sistema al posto suo. */
  expect(segni.filter((segno) => !segno.disegno)).toEqual([]);
  expect(segni.filter((segno) => segno.testo)).toEqual([]);
});

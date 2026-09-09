/* «Ci vorrebbe una sezione con i sensori presenza o movimento» (#432).
 *
 * Qui si guarda quello che vede chi ha quattro rilevatori in casa: la tessera
 * in Home col numero delle stanze occupate, la pagina con una carta per
 * rilevatore — blu chi rileva qualcuno, verde la stanza libera, smorto chi non
 * risponde — e la scheda del Config, che è quella dei Varchi con le stesse tre
 * correzioni.
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
  visibility: { home: true, presenza: true },
};

/* Un'ora fa: abbastanza perché la scritta «da quanto» dica un numero e non
 * «appena adesso», e sempre la stessa distanza da adesso qualunque sia l'ora
 * in cui questa prova gira. */
const UNORA_FA = () => new Date(Date.now() - 3_600_000).toISOString();

const STATI = () => ({
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "binary_sensor.presenza_salone": {
    entity_id: "binary_sensor.presenza_salone",
    state: "on",
    last_changed: UNORA_FA(),
    attributes: { friendly_name: "Salone", device_class: "occupancy" },
  },
  "binary_sensor.movimento_cucina": {
    entity_id: "binary_sensor.movimento_cucina",
    state: "off",
    last_changed: UNORA_FA(),
    attributes: { friendly_name: "Cucina", device_class: "motion" },
  },
  "binary_sensor.movimento_corridoio": {
    entity_id: "binary_sensor.movimento_corridoio",
    state: "off",
    last_changed: UNORA_FA(),
    attributes: { friendly_name: "Corridoio", device_class: "motion" },
  },
  "binary_sensor.movimento_garage": {
    entity_id: "binary_sensor.movimento_garage",
    state: "unavailable",
    last_changed: UNORA_FA(),
    attributes: { friendly_name: "Garage", device_class: "motion" },
  },
});

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
  }, STATI());
}

test("la tessera dice in quante stanze c'è qualcuno, e quali", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const tessera = page.locator('.dm-tile[data-dm-widget="presenza"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  /* Una sola: il salone. Il garage non risponde e non conta né di qua né di
   * là — contarlo libero sarebbe una bugia tranquillizzante. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("1");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Salone");
  /* Non si accende: qualcuno in casa è la normalità, non un allarme. */
  await expect(tessera).not.toHaveAttribute("data-alert", "true");

  await tessera.click();
  const occupata = page.locator("#dm-widget-popup .dm-w-pillola", { hasText: "Salone" });
  const libera = page.locator("#dm-widget-popup .dm-w-pillola", { hasText: "Cucina" });
  await expect(occupata).toHaveAttribute("data-tono", "acceso");
  await expect(libera).toHaveAttribute("data-tono", "quiete");
  /* Un'occupazione stabile e un movimento non dicono la stessa cosa. */
  await expect(occupata).toContainText("Occupato");
  await expect(libera).toContainText("Fermo");
  await page.locator("#dm-widget-popup").screenshot({
    path: testInfo.outputPath("tessera-presenza.png"),
  });
  await testInfo.attach("tessera-presenza", {
    path: testInfo.outputPath("tessera-presenza.png"),
    contentType: "image/png",
  });
});

test("la pagina Presenza elenca i rilevatori col loro colore e da quanto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const voce = page.locator('.tab[data-tab="presenza"]');
  await expect(voce).toBeVisible({ timeout: 20_000 });
  await voce.click();

  const pagina = page.locator("#page-presenza");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator(".dm-presenza-testa strong")).toHaveText(/In 1 stanza c'è qualcuno/i);

  const carte = pagina.locator(".dm-presenza");
  await expect(carte).toHaveCount(4);
  /* Prima chi rileva qualcuno: è la risposta alla domanda che si fa aprendo
   * la pagina. Poi i muti, che sono una sorveglianza che manca, e in fondo la
   * quiete. */
  await expect(carte.nth(0)).toHaveAttribute("data-presenza", "attivo");
  await expect(carte.nth(0)).toContainText("Salone");
  await expect(carte.nth(1)).toHaveAttribute("data-presenza", "muto");
  await expect(carte.nth(2)).toHaveAttribute("data-presenza", "libero");
  await expect(carte.nth(2)).toContainText("Corridoio");
  /* E ognuna dice da quanto sta così: è il pezzo per cui la pagina serve. */
  await expect(carte.nth(0)).toContainText(/Occupato da 1 ore/i);
  await expect(carte.nth(2)).toContainText(/Fermo da 1 ore/i);
  /* Lo scatto è dell'ELEMENTO e non della pagina intera: `fullPage` ridimensiona
   * la finestra per catturare tutto, il guscio ridisegna a metà scatto e ne esce
   * un'immagine vuota che sembra un difetto e non lo è. */
  await pagina.screenshot({ path: testInfo.outputPath("pagina-presenza.png") });
  await testInfo.attach("pagina-presenza", {
    path: testInfo.outputPath("pagina-presenza.png"),
    contentType: "image/png",
  });
});

test("la scheda del Config elenca i rilevatori e ne toglie uno", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("presenza"));

  const righe = page.locator("#ed-body .dm-presenza-ed-riga");
  await expect(righe).toHaveCount(4, { timeout: 20_000 });
  await page.locator("#ed-body").screenshot({ path: testInfo.outputPath("scheda-presenza.png") });
  await testInfo.attach("scheda-presenza", {
    path: testInfo.outputPath("scheda-presenza.png"),
    contentType: "image/png",
  });

  /* Il sensore del garage, che la casa non la guarda, si toglie dai conti — e
   * la configurazione se lo ricorda. Si filtra per l'entity_id e non per il
   * nome: il nome sta dentro un `<input>`, e il valore di una casella non è
   * testo della pagina. */
  await righe
    .filter({ hasText: "binary_sensor.movimento_garage" })
    .locator("[data-dm-presenza-escludi]")
    .click();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => JSON.parse(window.localStorage.getItem("cd_presenza") || "{}")?.escluse || [],
        ),
      { timeout: 10_000 },
    )
    .toEqual(["binary_sensor.movimento_garage"]);
  await expect(page.locator("#ed-body .dm-presenza-ed-riga")).toHaveCount(3);
});

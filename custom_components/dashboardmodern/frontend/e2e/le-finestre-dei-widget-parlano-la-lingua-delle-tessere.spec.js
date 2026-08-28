/* Le finestre dei widget devono somigliare alle tessere da cui si aprono.
 *
 * La tessera adesso porta un oggetto disegnato dentro una pastiglia a cuscino,
 * e il nome che si stringe invece di farsi tagliare. Se la finestra che si
 * apre restasse con l'emoji e col titolo che finisce sotto il tasto di
 * chiusura — «ELETTRODOMEST» — sarebbero due grafiche diverse a un tocco di
 * distanza.
 *
 * Qui si aprono le finestre di ogni tessera che la casa di prova produce, e si
 * guarda che parlino tutte la stessa lingua.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [
      { id: "a1", name: "Lavatrice", entity: "sensor.lavatrice_w", device_type: "washer" },
    ],
    loads: [],
    lights: [
      { id: "l1", name: "Lampadario Salone", entity: "light.salone" },
      { id: "l2", name: "Faretti Cucina", entity: "light.cucina" },
    ],
    climate: [{ id: "cl1", name: "Termosifone Salone", entity: "climate.salone" }],
    ev: [],
    covers: [{ id: "c1", name: "Tapparella Salone", entity: "cover.salone" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.home_temp": "sensor.temperatura_casa" },
  },
  visibility: { home: true, climate: true, lights: true, covers: true, appliances: true },
};

const VALORI = {
  "light.salone": "on",
  "light.cucina": "off",
  "cover.salone": "open",
  "sensor.lavatrice_w": "1200",
  "sensor.temperatura_casa": "27.6",
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [entity, state] of Object.entries(valori))
      grezzi[entity] = {
        entity_id: entity,
        state,
        attributes: {
          friendly_name: entity.split(".")[1].replaceAll("_", " "),
          ...(entity.endsWith("_w") ? { unit_of_measurement: "W" } : {}),
        },
      };
    grezzi["climate.salone"] = {
      entity_id: "climate.salone",
      state: "heat",
      attributes: {
        friendly_name: "Termosifone Salone",
        current_temperature: 20.5,
        temperature: 21.5,
      },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VALORI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#dm-widgets .dm-tile").first()).toBeVisible();
  await page.waitForTimeout(500);
}

const chiavi = (page) =>
  page.locator("#dm-widgets .dm-tile").evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWidget));

test("ogni finestra porta l'oggetto della sua tessera, e il titolo ci sta", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await avvia(page, testInfo);
  const tessere = await chiavi(page);
  expect(tessere.length).toBeGreaterThan(2);
  for (const chiave of tessere) {
    await page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`).click();
    const finestra = page.locator("#dm-widget-popup .dm-widget-detail");
    await expect(finestra, `la finestra di ${chiave} non si apre`).toBeVisible();
    const esito = await page.evaluate(() => {
      const testa = document.querySelector("#dm-widget-popup .dm-w-head");
      const titolo = testa?.querySelector("[data-dm-titolo]");
      const chiudi = testa?.querySelector(".dm-w-close");
      const bordoTitolo = titolo?.getBoundingClientRect();
      const bordoChiudi = chiudi?.getBoundingClientRect();
      return {
        disegno: Boolean(testa?.querySelector(".dm-w-head-ic .dm-oggetto")),
        tagliato: titolo ? titolo.scrollWidth > titolo.clientWidth + 1 : true,
        soprapposto: bordoTitolo && bordoChiudi ? bordoTitolo.right > bordoChiudi.left + 1 : true,
      };
    });
    expect(esito.disegno, `la finestra di ${chiave} non ha l'oggetto disegnato`).toBe(true);
    expect(esito.tagliato, `il titolo della finestra di ${chiave} e' tagliato`).toBe(false);
    expect(esito.soprapposto, `il titolo di ${chiave} finisce sotto il tasto di chiusura`).toBe(
      false,
    );
    await page.keyboard.press("Escape");
    await expect(finestra).toBeHidden();
  }
});

test("la finestra e la tessera usano la stessa pastiglia", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]').click();
  await expect(page.locator("#dm-widget-popup .dm-widget-detail")).toBeVisible();
  const stesso = await page.evaluate(() => {
    const tessera = document.querySelector(
      '#dm-widgets .dm-tile[data-dm-widget="luci"] .dm-oggetto',
    );
    const finestra = document.querySelector("#dm-widget-popup .dm-w-head-ic .dm-oggetto");
    if (!tessera || !finestra) return null;
    return tessera.innerHTML === finestra.innerHTML;
  });
  expect(stesso, "la finestra disegna un oggetto diverso da quello della tessera").toBe(true);
});

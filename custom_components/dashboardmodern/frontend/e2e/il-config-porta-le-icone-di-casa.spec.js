/* La configurazione parla con i disegni di casa, e ogni voce ha il suo.
 *
 * Dal campo, tre cose viste nella stessa schermata: «azioni ed energia hanno
 * lo stesso simbolo nel config, cambialo ad azioni rapide, crea un simbolo che
 * sia immediato»; «ti avevo chiesto di inserire icone nostre su tutta la
 * dashboard e continuo a vedere icone che non sono nostre»; «nella sezione
 * widget manca completamente minipc, inoltre non esiste piu' aspirapolvere ma
 * si chiama robot».
 *
 * La prova guarda i tre posti: la colonna delle schede, l'elenco delle tessere
 * e la Home, dove il MiniPC adesso ha la sua.
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
    entityOverrides: {
      "dm.server_cpu": "sensor.minipc_cpu",
      "dm.server_ram": "sensor.minipc_ram",
      "dm.server_disco": "sensor.minipc_disco",
    },
  },
  visibility: { home: true, server: true },
};

const quota = (state) => ({ state, attributes: { unit_of_measurement: "%" } });

const STATI = {
  "sensor.minipc_cpu": quota("37"),
  "sensor.minipc_ram": quota("62"),
  "sensor.minipc_disco": quota("71"),
};

async function apriConfig(page, scheda) {
  await page.evaluate((tab) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch(tab);
    } catch (_errore) {}
  }, scheda);
  await page.waitForTimeout(600);
}

test("nel menu del config ogni scheda ha il suo disegno, e le Azioni non sono l'Energia", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriConfig(page, "sez0");

  const leggiVoci = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#editor-modal .ed-tab[data-tab]")].map((b) => ({
        tab: b.dataset.tab,
        disegno: b.querySelector(".dm-beta4-tab-icon svg")?.outerHTML || "",
      })),
    );
  /* Il motore delle icone ridisegna la colonna dopo l'apertura: si aspetta che
   * abbia finito, non un istante a caso. */
  await expect
    .poll(async () => (await leggiVoci()).filter((voce) => !voce.disegno).length, {
      timeout: 20_000,
    })
    .toBe(0);
  const voci = await leggiVoci();

  /* Nessuna emoji di sistema: ogni voce porta un disegno nostro. */
  const senzaDisegno = voci.filter((voce) => !voce.disegno).map((voce) => voce.tab);
  expect(senzaDisegno).toEqual([]);

  /* E il segno delle Azioni non e' quello dell'Energia: era lo stesso fulmine,
   * e due voci vicine non si distinguevano. */
  const energia = voci.find((voce) => voce.tab === "sez1")?.disegno;
  const azioni = voci.find((voce) => voce.tab === "sez8")?.disegno;
  expect(energia).toBeTruthy();
  expect(azioni).toBeTruthy();
  expect(azioni).not.toBe(energia);
});

test("l'elenco delle tessere porta il MiniPC, chiama Robot il robot, e disegna in casa", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriConfig(page, "todo");

  const leggiRighe = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#ed-body .dm-widget-pref")].map((r) => ({
        key: r.dataset.widgetKey,
        nome: (r.querySelector(".ed-row-new")?.textContent || "").trim(),
        disegno: Boolean(r.querySelector(".dm-widget-pref-icon svg")),
      })),
    );
  await expect
    .poll(async () => (await leggiRighe()).length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  const righe = await leggiRighe();

  expect(righe.map((riga) => riga.key)).toContain("minipc");
  expect(righe.find((riga) => riga.key === "robot")?.nome).toBe("Robot");
  expect(righe.filter((riga) => !riga.disegno)).toEqual([]);
});

test("il MiniPC ha la sua tessera in Home, con la CPU in grande", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, STATI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  const tessera = page.locator('.dm-tile[data-dm-widget="minipc"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("37");
  /* Le altre due quote stanno in didascalia: la tessera racconta il MiniPC
   * senza doverla aprire. */
  await expect(tessera.locator("[data-dm-tile-caption]")).toHaveText(/RAM 62%.*Disco 71%/);
  await expect(tessera.locator(".dm-tile-chip svg")).toHaveCount(1);
});

test("la barra in basso porta i disegni di casa, non le emoji del telefono", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  const leggiSchede = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("nav.tabs .tab[data-tab]")]
        .filter((scheda) => scheda.querySelector(":scope > .icon"))
        .map((scheda) => ({
          tab: scheda.dataset.tab,
          disegno: Boolean(scheda.querySelector(":scope > .icon > svg")),
          testo: (scheda.querySelector(":scope > .icon")?.textContent || "").trim(),
        })),
    );
  /* La barra la riscrive il guscio: si aspetta che i disegni ci siano tutti. */
  await expect
    .poll(
      async () => {
        const lette = await leggiSchede();
        return lette.length && lette.every((scheda) => scheda.disegno);
      },
      { timeout: 20_000 },
    )
    .toBeTruthy();
  const schede = await leggiSchede();
  /* Le voci che ci sono sempre: se la lista fosse vuota — una barra non
   * disegnata, un runtime a meta' — il conto dei «senza disegno» sarebbe zero
   * e la prova passerebbe senza aver guardato niente. */
  expect(schede.map((scheda) => scheda.tab)).toEqual(expect.arrayContaining(["home", "config"]));
  expect(schede.length).toBeGreaterThan(4);
  /* Nessun carattere di sistema rimasto nella casella del simbolo. */
  expect(schede.filter((scheda) => scheda.testo)).toEqual([]);
});

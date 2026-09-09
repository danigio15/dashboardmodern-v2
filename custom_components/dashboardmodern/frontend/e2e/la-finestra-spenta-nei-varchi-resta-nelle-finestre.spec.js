/* «se la finestra e configurata nella sezione finestre e no nei varchi la
 *  segnalazione resta in finestre non deve scomparire»
 *
 * Lo stesso contatto sta scritto due volte: nelle Finestre, accanto alla
 * tapparella, e nei Varchi, che contano cosa e' aperto. Sono due sezioni e due
 * tessere della Home, e chi le ha configurate le voleva tutte e due.
 *
 * L'interruttore «nel widget» spegneva l'entita' e non la riga: toccarlo nei
 * Varchi la faceva sparire anche dalle Finestre, dove nessuno aveva chiesto
 * niente. Qui si prova sulla plancia vera — si tocca l'interruttore in una
 * scheda e si va a guardare le due tessere in Home.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CONTATTO = "binary_sensor.finestra_camera";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    /* Una finestra senza motori: solo il contatto sull'anta. E' la riga che la
     * segnalazione descrive, ed e' anche un varco per Home Assistant, che la
     * dichiara `window` da se'. */
    covers: [{ name: "Camera", contact: CONTATTO }],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true, varchi: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((id) => {
    const raw = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw)
      raw[id] = {
        entity_id: id,
        state: "on",
        attributes: { device_class: "window", friendly_name: "Finestra camera" },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CONTATTO);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForTimeout(1200);
}

const tessera = (page, chiave) => page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`);

/** L'interruttore dei widget sulla riga di quel contatto, nella scheda aperta. */
const interruttore = (page) =>
  page.locator(`#ed-body [data-dm-widget-entities="${CONTATTO}"]`).first();

async function nellaSchedaDeiVarchi(page) {
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('#editor-modal .ed-tab[data-tab="varchi"]').first().click();
  await expect(interruttore(page)).toBeVisible();
}

async function chiudiIlConfig(page) {
  await page.evaluate(() => document.querySelector("#editor-modal .ed-head-close")?.click());
  await expect(page.locator("#editor-modal")).toBeHidden();
}

const escluse = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_widgets") || "{}").excluded || [];
    } catch (_errore) {
      return [];
    }
  });

test.describe("la scelta dei widget parla di una tessera sola", () => {
  test("spenta nei Varchi, la finestra resta nelle Finestre", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await avvia(page, testInfo);
    // La stessa finestra racconta due tessere: e' il caso della segnalazione.
    await expect(tessera(page, "varchi")).toHaveCount(1);
    await expect(tessera(page, "tapparelle")).toHaveCount(1);

    await nellaSchedaDeiVarchi(page);
    /* L'interruttore sa in che scheda sta prima ancora che lo si tocchi: e' la
     * differenza fra spegnere una riga e spegnere un'entita'. */
    await expect(interruttore(page)).toHaveAttribute("data-dm-widget-tessera", "varchi");
    await interruttore(page).click();
    await expect(interruttore(page)).toHaveAttribute("data-on", "false");
    await expect.poll(() => escluse(page)).toEqual([`varchi|${CONTATTO}`]);
    await chiudiIlConfig(page);

    // Fuori dai Varchi — che e' quello che si e' chiesto — e ancora nelle
    // Finestre, dove nessuno aveva chiesto niente.
    await expect(tessera(page, "varchi")).toHaveCount(0);
    await expect(tessera(page, "tapparelle")).toHaveCount(1);
    await expect(tessera(page, "tapparelle")).toContainText("1");
  });

  test("rimessa nei Varchi torna, e nelle Finestre non se n'era mai andata", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await avvia(page, testInfo);
    await nellaSchedaDeiVarchi(page);
    await interruttore(page).click();
    await expect.poll(() => escluse(page)).toEqual([`varchi|${CONTATTO}`]);
    await interruttore(page).click();
    await expect(interruttore(page)).toHaveAttribute("data-on", "true");
    await expect.poll(() => escluse(page)).toEqual([]);
    await chiudiIlConfig(page);
    await expect(tessera(page, "varchi")).toHaveCount(1);
    await expect(tessera(page, "tapparelle")).toHaveCount(1);
  });

  test("una scelta gia' fatta continua a valere ovunque", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await avvia(page, testInfo);
    /* Le voci nude sono quelle che la gente ha gia' in configurazione: chi
     * aveva tolto qualcosa dalla Home non se lo deve ritrovare tornato al
     * primo aggiornamento. */
    await page.evaluate((id) => {
      localStorage.setItem("cd_widgets", JSON.stringify({ excluded: [id] }));
      window.DashboardModernModules?.render?.renderHomeWidgets?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, CONTATTO);
    await expect(tessera(page, "varchi")).toHaveCount(0);
    await expect(tessera(page, "tapparelle")).toHaveCount(0);

    // E l'interruttore lo dice: spento in tutte e due le schede.
    await nellaSchedaDeiVarchi(page);
    await expect(interruttore(page)).toHaveAttribute("data-on", "false");
  });
});

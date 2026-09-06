/* «È sparito il settaggio per la lingua della dashboard» (#350).
 *
 * «Su PC avevo settato italiano (HA in inglese) e continua a funzionare, da
 *  mobile invece è rimasto inglese.»
 *
 * Due cose da guardare, e sono quelle che si vedono: la tendina è ancora nelle
 * Impostazioni — anche dal telefono, dove la si cercava — e una scelta fatta
 * altrove arriva qui, invece di lasciare la plancia a seguire Home Assistant.
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

/* Home Assistant in inglese: è il caso della segnalazione, ed è la ragione per
 * cui una scelta che non viaggia si vede subito. */
async function boot(page, testInfo, { lingua = "" } = {}) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((scelta) => {
    window.__DASHBOARDMODERN_LOCALE__ = "en";
    if (!scelta) return;
    /* La scelta arriva già scritta, com'è per un dispositivo che riceve la
     * configurazione della casa: la chiave è quella della plancia, quindi
     * passa dal prefisso dell'istanza come tutte le altre. */
    const originale = Storage.prototype.getItem;
    Storage.prototype.getItem = function (chiave) {
      if (String(chiave).endsWith("cd_lingua")) return scelta;
      return originale.call(this, chiave);
    };
  }, lingua);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

async function apriLeImpostazioni(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="visib"]').first().click();
}

test("la tendina della lingua è nelle Impostazioni, anche dal telefono", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await apriLeImpostazioni(page);
  const riga = page.locator("#ed-body [data-dm-lingua]");
  await expect(riga).toHaveCount(1, { timeout: 15_000 });
  await expect(riga).toBeVisible();
  const tendina = riga.locator("[data-dm-lingua-scelta]");
  /* Nessuna scelta salvata: si segue Home Assistant, che qui parla inglese. */
  await expect(tendina).toHaveValue("auto");
  await expect(riga).toContainText(/Dashboard language|Lingua della plancia/);
});

test("la lingua scelta arriva col resto della configurazione", async ({ page }, testInfo) => {
  /* Home Assistant in inglese, la plancia scelta in italiano: prima, su questo
   * dispositivo, la scelta non c'era mai arrivata. */
  await boot(page, testInfo, { lingua: "it" });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 15_000 })
    .toBe("it");
  await apriLeImpostazioni(page);
  const tendina = page.locator("#ed-body [data-dm-lingua-scelta]");
  await expect(tendina).toHaveCount(1, { timeout: 15_000 });
  /* E la tendina lo dice: è «Italiano», non «Lingua di Home Assistant». */
  await expect(tendina).toHaveValue("it");
});

test("scegliere una lingua la scrive dove viaggia", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await apriLeImpostazioni(page);
  const tendina = page.locator("#ed-body [data-dm-lingua-scelta]");
  await expect(tendina).toHaveCount(1, { timeout: 15_000 });
  await tendina.selectOption("it");
  /* La chiave è della plancia: si scrive con il nome corto — il prefisso
   * dell'istanza glielo mette la memoria — e finisce sotto quel prefisso, che
   * è la stessa forma di tutte le chiavi che viaggiano con la configurazione.
   *
   * Il nome lungo NON si chiede a `getItem`: la memoria ci rimetterebbe il
   * prefisso davanti e cercherebbe una chiave che non esiste. Il giro sulle
   * chiavi invece le mostra come sono scritte davvero. */
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("cd_lingua")), {
      timeout: 15_000,
    })
    .toBe("it");
  const dovEScritta = await page.evaluate(() => {
    const spazio = window.__DASHBOARDMODERN_STORAGE_NS__;
    for (let indice = 0; indice < window.localStorage.length; indice += 1) {
      const chiave = window.localStorage.key(indice);
      if (chiave === `cd_${spazio}_cd_lingua`) return chiave;
    }
    return "";
  });
  expect(dovEScritta).not.toBe("");
  /* E la vecchia chiave del browser non torna a vivere. */
  expect(await page.evaluate(() => window.localStorage.getItem("dashboardmodern_locale"))).toBe(
    null,
  );
});

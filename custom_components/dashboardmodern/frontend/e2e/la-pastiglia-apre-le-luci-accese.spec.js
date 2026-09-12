/* La pastiglia della barra apre quello che e' acceso, non la tessera.
 *
 * «Devi cambiare popup dei dispositivi accesi che sono nella barra sotto al
 * menu. Devi mostrare solo quelli accesi e non una replica del popup widget.»
 *
 * Tre luci in casa, due accese. La pastiglia dice DUE, e toccandola deve
 * uscire un elenco di DUE — non la finestra della tessera, che le mostra tutte
 * e tre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LUCI = [
  { id: "l1", name: "Cucina", entity: "light.cucina" },
  { id: "l2", name: "Salone", entity: "light.salone" },
  { id: "l3", name: "Bagno", entity: "light.bagno" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: LUCI,
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

const VALORI = {
  "light.cucina": "on",
  "light.salone": "on",
  "light.bagno": "off",
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((valori) => {
    const stati = eval("_RAW_STATES");
    for (const [entity, state] of Object.entries(valori))
      stati[entity] = {
        entity_id: entity,
        state,
        attributes: { friendly_name: entity.split(".")[1] },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VALORI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator('#dm-casa-riga [data-dm-casa="luci"]')).toBeVisible();
}

test("la pastiglia apre l'elenco delle sole accese", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  const pastiglia = page.locator('#dm-casa-riga [data-dm-casa="luci"]');
  await expect(pastiglia.locator(".dm-casa-testa")).toHaveText("2");
  await pastiglia.click();

  const elenco = page.locator("#dm-casa-popup");
  /* Aperta o chiusa lo dice `hidden`, come nelle altre finestre dei widget:
     questa finestra si e' vestita come loro, e con loro condivide il modo di
     aprirsi. Prima era una classe `show` sua, di nessun altro. */
  await expect(elenco).toBeVisible();
  await expect(elenco.locator(".dm-casa-voce")).toHaveCount(2);
  const testo = (await elenco.locator(".dm-casa-voce").allTextContents()).join(" | ");
  expect(testo).toContain("cucina");
  expect(testo).toContain("salone");
  /* La terza e' spenta: in un elenco di cose accese non ci sta. */
  expect(testo).not.toContain("bagno");
  /* E non e' la finestra della tessera. */
  await expect(page.locator("#dm-widget-popup")).toBeHidden();
});

test("dall'elenco si spegne, e quando non resta niente si chiude", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  /* Il servizio si intercetta: qui non c'e' Home Assistant, e quello che conta
     e' che la plancia chieda la cosa giusta. */
  await page.evaluate(() => {
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push(`${dominio}.${servizio} ${dati.entity_id}`);
      const stati = eval("_RAW_STATES");
      stati[dati.entity_id] = { ...stati[dati.entity_id], state: "off" };
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
      return Promise.resolve();
    };
  });
  await page.locator('#dm-casa-riga [data-dm-casa="luci"]').click();
  const elenco = page.locator("#dm-casa-popup");
  await expect(elenco.locator(".dm-casa-voce")).toHaveCount(2);

  await elenco.locator(".dm-casa-spegni").first().click();
  await expect(elenco.locator(".dm-casa-voce")).toHaveCount(1);
  await elenco.locator(".dm-casa-spegni").first().click();
  /* Spenta l'ultima, la domanda «cosa e' rimasto acceso» ha avuto risposta. */
  await expect(elenco).toBeHidden();

  const chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate).toEqual([
    "homeassistant.turn_off light.cucina",
    "homeassistant.turn_off light.salone",
  ]);
});

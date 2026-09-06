/* Un fotogramma lo chiede il cronometro, non il movimento.
 *
 * Ogni istantanea e' Home Assistant che tira un'immagine dal flusso della
 * telecamera: lavoro del server di casa — il mini PC — moltiplicato per quante
 * telecamere ci sono sul muro. Il muro si aggiorna gia' da solo ogni quattro
 * secondi; in piu' c'era un ascolto sui cambi di stato che ne chiedeva altri a
 * ogni notifica della telecamera. Ma un cambio di stato di una telecamera — il
 * movimento rilevato, un attributo che si aggiorna — non porta nessun
 * fotogramma nuovo: davanti a una telecamera che vede passare qualcuno erano
 * decine di richieste al minuto in piu', per immagini identiche a quelle che il
 * cronometro stava gia' prendendo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [
      { id: "cam1", name: "Ingresso", entity: "camera.ingresso" },
      { id: "cam2", name: "Giardino", entity: "camera.giardino" },
    ],
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
  visibility: { home: true, security: true },
};

test("il movimento davanti alla telecamera non chiede fotogrammi", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Ogni fotogramma passa di qui: e' il proxy con cui Home Assistant tira
   * l'immagine dal flusso, ed e' quello che si conta. */
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64"),
    }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    window.__fotogrammi = 0;
    const vero = window.fetch;
    window.fetch = function contaFotogrammi(url, ...resto) {
      if (String(url?.url || url).includes("/api/camera_proxy/")) window.__fotogrammi += 1;
      return vero.call(this, url, ...resto);
    };
    const stati = eval("_RAW_STATES");
    for (const entity of ["camera.ingresso", "camera.giardino"])
      stati[entity] = {
        entity_id: entity,
        state: "idle",
        attributes: { entity_picture: `/api/camera_proxy/${entity}` },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  /* Sul muro della Sicurezza, che e' l'unico posto dove il cronometro parte. */
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((pagina) => pagina.classList.remove("active"));
    document.getElementById("page-security")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready", { detail: {} }));
  });
  await expect.poll(() => page.evaluate(() => window.__fotogrammi)).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  const dopoLApertura = await page.evaluate(() => window.__fotogrammi);

  /* Qualcuno passa davanti alle telecamere: venti notifiche in mezzo secondo,
   * come una casa vera. Il cronometro non c'entra — batte ogni quattro
   * secondi — e in questa finestra non deve arrivare nessuna richiesta. */
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (let giro = 0; giro < 20; giro += 1) {
      const entity = giro % 2 ? "camera.giardino" : "camera.ingresso";
      stati[entity] = {
        entity_id: entity,
        state: "recording",
        attributes: {
          entity_picture: `/api/camera_proxy/${entity}`,
          access_token: String(giro),
        },
      };
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: entity, entity_ids: [entity], coalesced: true },
        }),
      );
    }
  });
  await page.waitForTimeout(1200);
  const dopoIlMovimento = await page.evaluate(() => window.__fotogrammi);
  expect(dopoIlMovimento, "il movimento ha fatto chiedere fotogrammi").toBe(dopoLApertura);

  /* E il cronometro invece continua: il muro resta vivo, che e' la ragione per
   * cui il cronometro c'e'. */
  await expect
    .poll(() => page.evaluate(() => window.__fotogrammi), { timeout: 15_000 })
    .toBeGreaterThan(dopoIlMovimento);
});

/* Il verso di sensori e tapparelle si puo' invertire (#244).
 *
 * «I miei sensori porta e finestra quando la finestra è chiusa sono in stato
 * ON»; «lo slider al 100% considera aperte mentre vorrei che al 100% fossero
 * chiuse». Come nelle card Lovelace: i sensori girati stanno nella lista
 * cd_stati_invertiti, le tapparelle girate portano il flag sulla riga — e
 * tutta la plancia li legge (e li comanda) col verso vero.
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
    covers: [
      {
        id: "tp-1",
        name: "Tapparella studio",
        entity: "cover.studio",
        invertita: true,
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const STATI = {
  "binary_sensor.porta_girata": {
    entity_id: "binary_sensor.porta_girata",
    state: "on",
    attributes: { friendly_name: "Porta girata", device_class: "door" },
  },
  "cover.studio": {
    entity_id: "cover.studio",
    state: "open",
    attributes: { friendly_name: "Tapparella studio", current_position: 100 },
  },
};

async function semina(page) {
  await page.evaluate((extra) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...extra } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, extra);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, STATI);
}

test("il sensore girato conta e si legge al contrario", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await semina(page);
  await page.evaluate(() => {
    window.eval("GRUPPI_MONITORAGGIO['win'] = ['binary_sensor.porta_girata']");
  });

  /* Lo stesso conto del Quadro Avvisi, coi suoi ingredienti (il cdCount vero
   * vive dentro il ciclo di disegno e da fuori non si tocca). */
  const conta = () =>
    page.evaluate(() =>
      window.eval(
        "(GRUPPI_MONITORAGGIO['win']||[]).reduce((n,id)=>{const s=_RAW_STATES[id];return n+((s&&((s.state==='on')!==dmVersoInvertito(id)))?1:0);},0)",
      ),
    );
  /* Col verso di fabbrica, ON = aperta: il quadro la conta. */
  expect(await conta()).toBe(1);

  /* Girata col comando dell'editor, la stessa ON diventa «chiusa»: sparisce
   * dal conto, e la lista sincronizzata la ricorda. */
  await page.evaluate(() => window.edAvvVerso("binary_sensor.porta_girata"));
  expect(await conta()).toBe(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("cd_stati_invertiti") || "[]"),
    ),
  ).toEqual(["binary_sensor.porta_girata"]);
});

test("la tapparella girata legge 100 come chiusa e comanda tradotto", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await semina(page);

  /* La card del runtime: il device dice 100, la plancia (girata) scrive 0%. */
  const card = await page.evaluate(() => {
    const t = JSON.parse(window.localStorage.getItem("cd_tapparelle") || "[]")[0];
    return { invertita: t?.invertita === true, html: window.eval("cdTappCard")(t) };
  });
  expect(card.invertita).toBe(true);
  expect(card.html).toContain('class="tapp-pos">0%');

  /* La scrittura traduce nello stesso verso: 100 scelto (aperta) → 0 al
   * device. La si prova sulla pura funzione condivisa dei moduli. */
  const scritto = await page.evaluate(async () => {
    const modulo = await import("/src/core/verso-aperture.js");
    return modulo.posizioneSecondoVerso(100, true);
  });
  expect(scritto).toBe(0);
});

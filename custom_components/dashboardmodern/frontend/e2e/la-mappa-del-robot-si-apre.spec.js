/* «L'aspirapolvere mi fa vedere solo un pezzo della mappa: non si può aprire,
 * né spostare, né zoommare.»
 *
 * Nella card la mappa sta in un riquadro quattro terzi: ci sta tutta — è
 * disegnata `contain`, non ritagliata — ma di una casa intera dentro
 * trecento pixel non si legge niente, e non c'era modo di guardarla più da
 * vicino. Adesso si apre a schermo pieno, si trascina e si ingrandisce.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Un'immagine larga, così l'ingrandimento ha qualcosa da mostrare. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const STATI = {
  "vacuum.piano_terra": {
    entity_id: "vacuum.piano_terra",
    state: "docked",
    attributes: {
      friendly_name: "Piper",
      battery_level: 100,
      supported_features: 8192 + 4 + 8 + 16 + 32 + 64,
    },
  },
  "camera.piano_terra_map": {
    entity_id: "camera.piano_terra_map",
    state: "idle",
    attributes: { entity_picture: "/api/camera_proxy/camera.piano_terra_map?token=abc" },
  },
};

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
    robots: [
      {
        id: "robot-1",
        name: "Piper",
        entity: "vacuum.piano_terra",
        mapEntity: "camera.piano_terra_map",
      },
    ],
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, robot: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((valori) => {
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");
  await expect(page.locator("#page-robot")).toHaveClass(/active/);
  const mappa = page.locator("[data-dm-robot-map-open]");
  await expect(mappa).toHaveCount(1);
  /* La mappa si apre quando il disegno e' arrivato: prima non c'e' niente da
     ingrandire, e il riquadro lo dice. */
  await expect(mappa).toHaveAttribute("data-dm-map-state", "ready");
  return mappa;
}

const lettura = (page) =>
  page.evaluate(() => {
    const visore = document.getElementById("dm-robot-map-view");
    const figura = visore?.querySelector("[data-dm-map-big]");
    return {
      aperto: Boolean(visore) && !visore.hidden,
      trasformazione: figura ? figura.style.transform : "",
      ingrandita: figura?.dataset.dmZoom === "true",
      sorgente: figura?.getAttribute("src") || "",
    };
  });

test("toccando la mappa si apre a schermo pieno, con lo stesso disegno", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mappa = await avvia(page, testInfo);
  await mappa.evaluate((nodo) => nodo.click());
  const stato = await lettura(page);
  expect(stato.aperto).toBe(true);
  // Il disegno e' quello che la card ha gia' preso: nessuna richiesta in piu'.
  expect(stato.sorgente).toBeTruthy();
  expect(stato.ingrandita).toBe(false);
});

test("si ingrandisce, e il tasto che rimette com'era la rimette com'era", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mappa = await avvia(page, testInfo);
  await mappa.evaluate((nodo) => nodo.click());
  await page.locator("#dm-robot-map-view [data-dm-map-in]").evaluate((nodo) => nodo.click());
  const dopo = await lettura(page);
  expect(dopo.ingrandita).toBe(true);
  expect(dopo.trasformazione).toMatch(/scale\(1\.[1-9]/);

  await page.locator("#dm-robot-map-view [data-dm-map-reset]").evaluate((nodo) => nodo.click());
  const azzerata = await lettura(page);
  expect(azzerata.ingrandita).toBe(false);
  expect(azzerata.trasformazione).toContain("scale(1)");
});

test("si rimpicciolisce anche sotto misura, centrata, e si chiude", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const mappa = await avvia(page, testInfo);
  await mappa.evaluate((nodo) => nodo.click());
  /* Sotto l'uno SI VA. Il divieto («francobollo in mezzo al nero») presumeva
     che a misura la mappa si vedesse tutta; dal campo e' arrivato il
     contrario — «zoom in avanti ma non indietro, e non si apre completa» — e
     quando la misura tradisce, rimpicciolire e' l'unica via d'uscita.
     Sotto misura resta centrata, e il pavimento e' 0.4. */
  for (let giro = 0; giro < 6; giro += 1)
    await page.locator("#dm-robot-map-view [data-dm-map-out]").evaluate((nodo) => nodo.click());
  const rimpicciolita = await lettura(page);
  expect(rimpicciolita.trasformazione).toContain("scale(0.4)");
  expect(rimpicciolita.trasformazione).toContain("translate(0px, 0px)");

  await page.locator("#dm-robot-map-view [data-dm-map-reset]").evaluate((nodo) => nodo.click());
  expect((await lettura(page)).trasformazione).toContain("scale(1)");

  await page.locator("#dm-robot-map-view [data-dm-map-close]").evaluate((nodo) => nodo.click());
  expect((await lettura(page)).aperto).toBe(false);
});

test("ingrandita, si scorre col mouse — come nella card nativa di HA", async ({
  page,
}, testInfo) => {
  /* «Credo manchi solo la possibilità di scorrere con il mouse una volta
   * ingrandita come succede per la card standard di HA»: il trascinamento
   * c'e', e questa prova lo tiene fermo — rotella per ingrandire, poi il
   * mouse che preme e trascina sposta davvero la mappa.
   *
   * Sull'iPad la rotella non esiste nemmeno come API («Mouse wheel is not
   * supported in mobile WebKit»): questo e' il gesto della scrivania, e li'
   * si ingrandisce col pizzico — che le prove qui sopra coprono gia'. */
  test.skip(
    testInfo.project.name === "webkit-ipad",
    "la rotella del mouse non esiste nel WebKit mobile",
  );
  const mappa = await avvia(page, testInfo);
  await mappa.dispatchEvent("click");
  await expect.poll(async () => (await lettura(page)).aperto).toBe(true);

  const palco = page.locator("#dm-robot-map-view [data-dm-map-stage]");
  const riquadro = await palco.boundingBox();
  const centro = { x: riquadro.x + riquadro.width / 2, y: riquadro.y + riquadro.height / 2 };

  /* La rotella ingrandisce attorno al punto. */
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.wheel(0, -240);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await lettura(page)).ingrandita).toBe(true);
  const prima = (await lettura(page)).trasformazione;

  /* Il mouse preme e trascina: la mappa lo segue. */
  await page.mouse.down();
  await page.mouse.move(centro.x + 120, centro.y + 80, { steps: 6 });
  await page.mouse.up();
  const dopo = await lettura(page);
  expect(dopo.trasformazione).not.toBe(prima);
  const [, x, y] = dopo.trasformazione.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/) || [];
  expect(Number(x)).toBeGreaterThan(0);
  expect(Number(y)).toBeGreaterThan(0);
});

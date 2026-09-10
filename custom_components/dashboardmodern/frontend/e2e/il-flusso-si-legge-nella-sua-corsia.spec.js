/* La card del flusso, dentro la corsia stretta che ha.
 *
 * «Ma guardalo tu stesso e vedi che non entra, non si vede nulla.»
 *
 * Ed era vero, e da uno screenshot con numeri corti non si vedeva: la scena
 * era quadrata, e in una corsia da 177px veniva 153x153 con dischi da 31px e
 * numeri da 9px. Niente era ritagliato — la misura lo confermava — e proprio
 * per questo guardare non bastava: il difetto era che tutto stava dentro, ma
 * troppo piccolo per essere letto.
 *
 * Queste prove misurano le tre cose che l'occhio non vede su un disegno con
 * numeri corti, e che sono cadute tutte e tre almeno una volta:
 *
 *  1. che niente esca dalla card — nemmeno di un pixel, perche' la card
 *     ritaglia e quello che esce non c'e' piu';
 *  2. che due numeri non si sovrappongano. Coi numeri lunghi — «12,4 kW»,
 *     cinque caratteri — tre pastiglie sulla stessa riga in 153px non ci
 *     stanno, e si accavallavano;
 *  3. che le linee del flusso ARRIVINO ai cerchi. E' il difetto piu' subdolo:
 *     la scena e' diventata verticale e il viewBox era rimasto quadrato, cosi'
 *     il disegno delle linee finiva schiacciato in un quadrato centrato mentre
 *     i nodi usavano l'altezza intera. Sullo schermo i tratteggi partivano dal
 *     sole e non raggiungevano piu' la casa, e nessuna misura sui rettangoli
 *     se ne sarebbe accorta.
 *
 * Il seme porta i numeri piu' lunghi che la card puo' mostrare — cinque
 * caratteri su ogni nodo — perche' e' il caso in cui le cose si toccano.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SOLARE = "sensor.fv_potenza",
  RETE = "sensor.rete_potenza",
  BATTERIA = "sensor.batteria_potenza",
  CARICA = "sensor.batteria_carica",
  CASA = "sensor.casa_potenza",
  AUTO = "sensor.wallbox_potenza";
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
    energy: {
      solar: { power: SOLARE },
      grid: { power: RETE },
      battery: { power: BATTERIA, soc: CARICA },
      house: { power: CASA },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};
const PERSONE = [{ id: "person-giovanni", name: "Giovanni", entity: "person.giovanni" }];
const m = (id, v, u, c) => ({
  entity_id: id,
  state: String(v),
  attributes: { unit_of_measurement: u, device_class: c, friendly_name: id },
});
/* Il caso peggiore per la larghezza: numeri a cinque caratteri su ogni nodo. */
const STATI = {
  [SOLARE]: m(SOLARE, 12400, "W", "power"),
  [RETE]: m(RETE, -600, "W", "power"),
  [BATTERIA]: m(BATTERIA, -10500, "W", "power"),
  [CARICA]: m(CARICA, 64, "%", "battery"),
  [CASA]: m(CASA, 11800, "W", "power"),
  [AUTO]: m(AUTO, 7400, "W", "power"),
};

for (const larghezza of [360, 390, 412]) {
  test(`la card del flusso si legge a ${larghezza}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
    await page.evaluate(
      ({ stati, persone }) => {
        window.localStorage.setItem("cd_people", JSON.stringify(persone));
        window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
        const raw = window.eval("typeof _RAW_STATES!=='undefined'?_RAW_STATES:null");
        if (raw) Object.assign(raw, stati);
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      },
      { stati: STATI, persone: PERSONE },
    );
    await expect(page.locator("#dm-flusso-card")).toBeVisible({ timeout: 20_000 });
    const rapporto = await page.evaluate(() => {
      const card = document.querySelector("#dm-flusso-card");
      const c = card.getBoundingClientRect();
      const fuori = [];
      for (const el of card.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const sopra = c.top - r.top,
          sotto = r.bottom - c.bottom;
        const sx = c.left - r.left,
          dx = r.right - c.right;
        if (Math.max(sopra, sotto, sx, dx) > 0.6)
          fuori.push({
            che: el.className?.toString?.().slice(0, 40) || el.tagName,
            testo: (el.textContent || "").trim().slice(0, 12),
            sopra: +sopra.toFixed(1),
            sotto: +sotto.toFixed(1),
            sx: +sx.toFixed(1),
            dx: +dx.toFixed(1),
          });
      }
      const scena = card.querySelector(".dm-flusso-scena")?.getBoundingClientRect();
      const valori = [...card.querySelectorAll(".dm-flusso-valore,.dm-flusso-usa")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          testo: el.textContent.trim(),
          w: +r.width.toFixed(1),
          fuoriScena: scena
            ? +Math.max(
                scena.top - r.top,
                r.bottom - scena.bottom,
                scena.left - r.left,
                r.right - scena.right,
              ).toFixed(1)
            : null,
        };
      });
      /* Due pastiglie che si toccano: e' il difetto che l'occhio non vede su
       * uno screenshot con numeri corti. */
      const pastiglie = [...card.querySelectorAll(".dm-flusso-valore,.dm-flusso-usa")]
        .filter((el) => el.textContent.trim())
        .map((el) => ({ testo: el.textContent.trim(), r: el.getBoundingClientRect() }));
      const collisioni = [];
      for (let i = 0; i < pastiglie.length; i += 1)
        for (let j = i + 1; j < pastiglie.length; j += 1) {
          const a = pastiglie[i].r,
            b = pastiglie[j].r;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
            collisioni.push(`${pastiglie[i].testo} x ${pastiglie[j].testo}`);
        }
      /* E un numero sopra un cerchio che non e' il suo. */
      const dischi = [...card.querySelectorAll(".dm-flusso-disco")].map((el) =>
        el.getBoundingClientRect(),
      );
      for (const { testo, r } of pastiglie)
        for (const d of dischi)
          if (
            r.left < d.right - 2 &&
            d.left < r.right - 2 &&
            r.top < d.bottom - 2 &&
            d.top < r.bottom - 2
          )
            collisioni.push(`${testo} sopra un cerchio`);
      /* I due capi di ogni linea, portati in coordinate di pagina: cadono
       * dentro il cerchio da cui partono e in quello a cui arrivano? */
      const dentroIlCerchio = (punto, chiave) => {
        const nodo = card.querySelector(`.dm-flusso-nodo[data-nodo="${chiave}"] .dm-flusso-disco`);
        if (!nodo) return false;
        const d = nodo.getBoundingClientRect();
        const cx = d.left + d.width / 2,
          cy = d.top + d.height / 2;
        return Math.hypot(punto.x - cx, punto.y - cy) <= d.width / 2 + 1;
      };
      const archi = [...card.querySelectorAll(".dm-flusso-arco")].map((path) => {
        const svg = path.ownerSVGElement;
        const alPunto = (p) => {
          const m = path.getScreenCTM();
          const q = svg.createSVGPoint();
          q.x = p.x;
          q.y = p.y;
          const t = q.matrixTransform(m);
          return { x: t.x, y: t.y };
        };
        const lunghezza = path.getTotalLength();
        const partenza = alPunto(path.getPointAtLength(0));
        const arrivo = alPunto(path.getPointAtLength(lunghezza));
        const da = path.dataset.da,
          a = path.dataset.a;
        /* La linea puo' essere disegnata al contrario di come scorre: allora i
         * capi sono scambiati, e vanno bene comunque. */
        const diritta = dentroIlCerchio(partenza, da) && dentroIlCerchio(arrivo, a);
        const rovescia = dentroIlCerchio(partenza, a) && dentroIlCerchio(arrivo, da);
        return { da, a, partenzaDentro: diritta || rovescia, arrivoDentro: diritta || rovescia };
      });
      return {
        collisioni,
        archi,
        card: { w: +c.width.toFixed(1), h: +c.height.toFixed(1) },
        scena: scena ? { w: +scena.width.toFixed(1), h: +scena.height.toFixed(1) } : null,
        fuori,
        valori,
      };
    });
    expect(rapporto.fuori, `${larghezza}px: qualcosa esce dalla card`).toEqual([]);
    expect(rapporto.collisioni, `${larghezza}px: due scritte si accavallano`).toEqual([]);
    /* Ogni linea accesa deve toccare i due cerchi che collega: e' la prova che
     * le coordinate delle linee e quelle dei nodi sono le stesse. */
    expect(rapporto.archi.length, `${larghezza}px: nessuna linea di flusso`).toBeGreaterThan(0);
    for (const arco of rapporto.archi) {
      expect(
        arco.partenzaDentro,
        `${larghezza}px: la linea ${arco.da}→${arco.a} non parte dal cerchio ${arco.da}`,
      ).toBe(true);
      expect(
        arco.arrivoDentro,
        `${larghezza}px: la linea ${arco.da}→${arco.a} non arriva al cerchio ${arco.a}`,
      ).toBe(true);
    }
    await page
      .locator("#dm-people .dm-people-fila")
      .screenshot({ path: testInfo.outputPath(`fila-${larghezza}.png`) });
  });
}

/* «Sarebbe possibile visualizzare la percentuale della batteria e non solo la
 * potenza?» (#459)
 *
 * Chiesto da un iPhone, e da lì era una domanda senza risposta: il numero
 * c'era, ma solo nel titolo del nodo — cioè nel suggerimento del mouse, che su
 * un telefono non esiste. Restava l'anello, che un 10% da un 90% lo distingue
 * benissimo e un 55% da un 65% per niente.
 *
 * Si guarda al telefono, che è dove la domanda è nata, e si guarda che il
 * numero stia dentro la card: una riga in più su un nodo è esattamente il modo
 * in cui una card stretta comincia a debordare.
 */
test("la carica della batteria si legge, e sta dentro la card", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(
    ({ stati, persone }) => {
      window.localStorage.setItem("cd_people", JSON.stringify(persone));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES!=='undefined'?_RAW_STATES:null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, persone: PERSONE },
  );

  const card = page.locator("#dm-flusso-card");
  await expect(card).toBeVisible({ timeout: 20_000 });
  const carica = card.locator(".dm-flusso-soc");
  /* Una sola: la carica ce l'ha la batteria, e nessun altro nodo. */
  await expect(carica).toHaveCount(1);
  await expect(carica).toHaveText("64%");
  /* E sta sul nodo della batteria, non su un altro. */
  await expect(card.locator('.dm-flusso-nodo[data-nodo="batteria"] .dm-flusso-soc')).toHaveCount(1);

  const dentro = await page.evaluate(() => {
    const c = document.querySelector("#dm-flusso-card").getBoundingClientRect();
    const r = document.querySelector(".dm-flusso-soc").getBoundingClientRect();
    return {
      fuori: +Math.max(
        c.top - r.top,
        r.bottom - c.bottom,
        c.left - r.left,
        r.right - c.right,
      ).toFixed(1),
      alta: +r.height.toFixed(1),
    };
  });
  expect(dentro.fuori).toBeLessThanOrEqual(0.6);
  /* Leggibile vuol dire alta abbastanza da essere una scritta e non un segno. */
  expect(dentro.alta).toBeGreaterThan(9);

  await card.screenshot({ path: testInfo.outputPath("flusso-carica.png") });
  await testInfo.attach("flusso-carica", {
    path: testInfo.outputPath("flusso-carica.png"),
    contentType: "image/png",
  });
});

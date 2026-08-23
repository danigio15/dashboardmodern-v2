/* La mappa dei flussi, coi numeri delle segnalazioni vere.
 *
 * «Il disegno mi indica che rete e batteria stanno alimentando casa. In
 * realta' rete alimenta casa e ricarica batteria»; «il solare mi carica la
 * batteria, perche' vedo che va in casa?». Il runtime accendeva le linee un
 * numero alla volta, e l'arco rete → batteria non esisteva proprio.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
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
    /* Gli slot dm.energy_* li possiede il modello: la proiezione li ricava
     * da qui e cancella gli orfani scritti a mano nelle mappature. */
    energy: {
      solar: { power: "sensor.fv_w" },
      grid: { power: "sensor.rete_w" },
      battery: { power: "sensor.batt_w" },
      metadata: { semantics_version: 3 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

async function conNumeri(page, { solare, rete, batteria }) {
  await page.evaluate(
    ({ solare, rete, batteria }) => {
      const scrivi = (id, valore) => {
        _RAW_STATES[id] = {
          entity_id: id,
          state: String(valore),
          attributes: { unit_of_measurement: "W" },
        };
        STATES[id] = _RAW_STATES[id];
      };
      scrivi("sensor.fv_w", solare);
      scrivi("sensor.rete_w", rete);
      scrivi("sensor.batt_w", batteria);
      window.render?.();
    },
    { solare, rete, batteria },
  );
  await page.waitForTimeout(250);
}

const linee = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [
        "line-solar-home",
        "line-solar-battery",
        "line-grid-home",
        "line-grid-battery",
        "line-battery-home",
        "line-solar-grid",
        "line-battery-grid",
      ].map((id) => [id, Boolean(document.getElementById(id)?.classList.contains("active"))]),
    ),
  );

test("rete → casa e rete → batteria, non «batteria che alimenta casa»", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((n) => n.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true), {
      timeout: 60_000,
    })
    .toBe(true);
  await page.evaluate(() => document.querySelector('[data-tab="energy"]')?.click());

  /* Il video delle 06:38: notte, la rete alimenta casa e ricarica la batteria. */
  await conNumeri(page, { solare: 0, rete: 577.7, batteria: -189 });
  await expect
    .poll(() => linee(page))
    .toMatchObject({
      "line-grid-home": true,
      "line-grid-battery": true,
      "line-battery-home": false,
      "line-solar-home": false,
      "line-solar-battery": false,
    });

  /* Il video delle 07:46: il solare finisce tutto in batteria, la casa la
   * regge la rete: «solare → casa» deve restare spenta. */
  await conNumeri(page, { solare: 146.3, rete: 295.9, batteria: -201 });
  await expect
    .poll(() => linee(page))
    .toMatchObject({
      "line-solar-battery": true,
      "line-solar-home": false,
      "line-grid-home": true,
      "line-grid-battery": true,
      "line-battery-home": false,
    });
  /* E la bolla della batteria dice grandezza e verso, non «-201 W». */
  await expect
    .poll(() => page.evaluate(() => document.getElementById("v-battery")?.textContent || ""))
    .toContain("▼ 201");

  /* La scarica vera: batteria → casa acceso, rete → batteria spento. */
  await conNumeri(page, { solare: 0, rete: 100, batteria: 300 });
  await expect
    .poll(() => linee(page))
    .toMatchObject({
      "line-battery-home": true,
      "line-grid-battery": false,
      "line-grid-home": true,
    });

  /* L'immissione della batteria esce dal SUO arco: con 100 W di solare e
   * 400 W immessi, 100 escono dal pannello e 300 dalla batteria — non
   * un'esportazione tutta disegnata da un solare che ne produce un quarto. */
  await conNumeri(page, { solare: 100, rete: -400, batteria: 500 });
  await expect
    .poll(() => linee(page))
    .toMatchObject({
      "line-solar-grid": true,
      "line-battery-grid": true,
      "line-battery-home": true,
      "line-grid-home": false,
      "line-grid-battery": false,
    });
});

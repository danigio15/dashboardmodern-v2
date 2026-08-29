/* La sezione Energia non sfarfalla mentre i watt si muovono.
 *
 * «Sezione energia che flicka con qualcosa sotto, un altro duplicato.»
 *
 * Erano due cose insieme. La prima: il guscio e il modulo scrivevano gli stessi
 * numeri, presi da due parti diverse — il guscio dalle caselle vecchie, il
 * modulo da Recorder — e si riscrivevano a vicenda a ogni cambio di stato.
 * Quello che si vedeva erano due valori che si alternavano. La seconda: il
 * paragone «e' gia' scritto?» si faceva con `innerHTML`, che il documento
 * restituisce rinormalizzato — `color:var(--x,#fff)` torna come
 * `color: var(--x, #fff);` — quindi non tornava mai e si riscriveva sempre.
 *
 * In una casa vera i watt cambiano decine di volte al secondo. Qui se ne fanno
 * trenta in tre secondi, che e' molto meno, e si pretende che in quel tempo
 * nessun pezzo del flusso venga distrutto e rifatto: distruggere e rifare e'
 * esattamente cio' che si vede come sfarfallio.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
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
      house: { power: "sensor.casa_w" },
      solar: { power: "sensor.solare_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
      grid: { power: "sensor.rete_w" },
    },
  },
  visibility: { energy: true },
};

test("mentre i watt si muovono niente viene distrutto e rifatto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed)))
    .toBe(true);

  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    const metti = (id, valore, unita) => {
      grezzi[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { friendly_name: id, unit_of_measurement: unita },
      };
    };
    metti("sensor.casa_w", 194, "W");
    metti("sensor.solare_w", 242, "W");
    metti("sensor.batteria_w", 63, "W");
    metti("sensor.batteria_soc", 66, "%");
    metti("sensor.rete_w", 0, "W");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.evaluate(() => document.querySelector('[data-tab="energy"]')?.click());
  await page.waitForTimeout(1200);

  const rifatti = await page.evaluate(async () => {
    const pagina = document.getElementById("page-energy");
    if (!pagina) return ["pagina energia assente"];
    const fuori = [];
    const occhio = new MutationObserver((records) => {
      for (const record of records)
        for (const nodo of record.addedNodes)
          if (nodo instanceof Element)
            fuori.push(
              `${nodo.tagName.toLowerCase()} dentro ${(record.target.className || record.target.id || "").toString().split(" ")[0]}`,
            );
    });
    occhio.observe(pagina, { subtree: true, childList: true });
    const grezzi = eval("_RAW_STATES");
    for (let giro = 0; giro < 30; giro += 1) {
      grezzi["sensor.casa_w"].state = String(190 + (giro % 9));
      grezzi["sensor.solare_w"].state = String(240 + (giro % 5));
      if (window.cdRenderSoon) window.cdRenderSoon();
      else window.render?.();
      await new Promise((r) => setTimeout(r, 100));
    }
    occhio.disconnect();
    return fuori;
  });

  expect(rifatti, `rifatti da capo: ${[...new Set(rifatti)].join(", ")}`).toEqual([]);
});

/* Nel flusso Energia c'e' una serie sola di bolle.
 *
 * Segnalato guardando la sezione: «all'improvviso compare un altro cerchio
 * sotto e uno sovrascrive wallbox». Non uno sfarfallio — due serie disegnate
 * insieme.
 *
 * Da dove veniva. Nel guscio ci sono cinque bolle a posto fisso (Boiler,
 * Wallbox, Clima, Lavanderia, Cucina), di quando i carichi erano quei cinque.
 * Oggi li disegna il flusso nuovo, dove servono, e ritira le vecchie
 * nascondendole. La scheda dei nodi pero' rimetteva a posto la proprieta'
 * `display` di quelle stesse bolle ogni volta che una veniva riaccesa in
 * configurazione — cancellando il `none` del flusso. La bolla vecchia tornava
 * al suo posto fisso: un cerchio in piu' in fondo, e uno sopra il Wallbox.
 *
 * Questa prova rifa' il giro — bolla spenta, bolla riaccesa — e pretende che
 * nessuna delle cinque vecchie si dipinga.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const VECCHIE = ["n-boiler", "n-wb", "n-clima", "n-lav", "n-cuc"];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [
      { id: "c1", name: "Boiler", power_entity: "sensor.boiler_w", order: 0 },
      { id: "c2", name: "Wallbox", power_entity: "sensor.wallbox_w", order: 1 },
      { id: "c3", name: "Clima", power_entity: "sensor.clima_w", order: 2 },
    ],
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

async function bolleDipinte(page, ids) {
  return page.evaluate((elenco) => {
    const dipinta = (n) => {
      if (!n) return false;
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    return elenco.filter((id) => dipinta(document.getElementById(id)));
  }, ids);
}

test("le bolle vecchie del flusso restano ritirate anche riaccendendone una", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });

  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    const metti = (id, valore) => {
      stati[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { unit_of_measurement: "W" },
      };
    };
    metti("sensor.casa_w", 246);
    metti("sensor.solare_w", 3442);
    metti("sensor.batteria_w", 90);
    metti("sensor.rete_w", -2822);
    metti("sensor.boiler_w", 0);
    metti("sensor.wallbox_w", 0);
    metti("sensor.clima_w", 8);
    window.applyStates?.();
    window.render?.();
  });
  await page.evaluate(() => document.querySelector('.tab[data-tab="energy"]')?.click());
  await page.waitForTimeout(900);

  expect(await bolleDipinte(page, VECCHIE)).toEqual([]);
  /* Il flusso nuovo c'e' davvero: senza questa, la prova sopra passerebbe anche
   * con la sezione vuota. */
  expect(
    await page.evaluate(() => document.querySelectorAll("#view-ist [data-dm-flow-node]").length),
  ).toBeGreaterThan(0);

  /* Il giro che rompeva: una bolla spenta in configurazione, e poi riaccesa. */
  await page.evaluate(async () => {
    const scheda = await import("/src/sections/beta26-real-device-stability-section.js");
    localStorage.setItem("cd_flow_nodes", JSON.stringify({ wb: { enabled: false } }));
    scheda.applyFlowNodeCustomization();
    localStorage.setItem("cd_flow_nodes", JSON.stringify({ wb: { enabled: true } }));
    scheda.applyFlowNodeCustomization();
  });
  await page.waitForTimeout(400);

  expect(await bolleDipinte(page, VECCHIE)).toEqual([]);
});

/* «Apri la finestra per arieggiare» (#330), sulla finestra vera.
 *
 * La logica sta nel nucleo e ha le sue prove; qui si guarda la cosa che uno
 * vede: la riga che compare sulla card della finestra della stanza umida, e
 * che NON compare quando fuori l'aria e' peggio di dentro — che e' la meta'
 * della richiesta, e quella che rende il consiglio onesto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-bagno",
        name: "Bagno",
        icon: "🚿",
        temp: "sensor.bagno_temperatura",
        hum: "sensor.bagno_umidita",
      },
      {
        id: "room-salone",
        name: "Salone",
        icon: "🛋️",
        temp: "sensor.salone_temperatura",
        hum: "sensor.salone_umidita",
      },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [
      { id: "c1", name: "Finestra bagno", entity: "cover.bagno", room_id: "room-bagno" },
      { id: "c2", name: "Finestra salone", entity: "cover.salone", room_id: "room-salone" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.home_meteo_umidita": "sensor.meteo_umidita" },
  },
  visibility: { home: true, tapparelle: true, temp: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

/* Il bagno dopo una doccia: fradicio. Il salone: normale. */
const STATI = [
  stato("cover.bagno", "closed", { friendly_name: "Finestra bagno", current_position: 0 }),
  stato("cover.salone", "closed", { friendly_name: "Finestra salone", current_position: 0 }),
  stato("sensor.bagno_umidita", "78", {
    friendly_name: "Umidità bagno",
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  stato("sensor.salone_umidita", "48", {
    friendly_name: "Umidità salone",
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  stato("sensor.bagno_temperatura", "23", {
    friendly_name: "Temperatura bagno",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  stato("sensor.salone_temperatura", "21", {
    friendly_name: "Temperatura salone",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
];

async function avvia(page, testInfo, umiditaFuori) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ haStati, fuori }) => {
      for (const voce of haStati) _RAW_STATES[voce.entity_id] = structuredClone(voce);
      _RAW_STATES["sensor.meteo_umidita"] = {
        entity_id: "sensor.meteo_umidita",
        state: String(fuori),
        attributes: {
          friendly_name: "Umidità esterna",
          device_class: "humidity",
          unit_of_measurement: "%",
        },
      };
      if (typeof STATES !== "undefined")
        for (const [id, voce] of Object.entries(_RAW_STATES)) STATES[id] = structuredClone(voce);
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-tapparelle")?.classList.add("active");
      window.renderTapparelle?.();
      /* Il modulo delle finestre ridisegna sugli eventi di stato: annunciarli
       * e' quello che fa il runtime quando Home Assistant parla. */
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { haStati: STATI, fuori: umiditaFuori },
  );
  const bagno = page.locator('#page-tapparelle .tapp-card[data-tapp="cover.bagno"]');
  await expect(bagno).toBeVisible();
  return bagno;
}

const consiglio = (card) => card.locator("[data-dm-arieggia]");

test("col bagno fradicio e l'aria di fuori asciutta, la finestra dice di aprire", async ({
  page,
}, testInfo) => {
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await expect(consiglio(bagno)).toContainText("78%");
  await expect(consiglio(bagno)).toContainText("41%");

  /* Il salone e' al quarantotto: sotto la soglia, e li' non c'e' niente da
   * suggerire. Il consiglio e' della stanza, non della casa. */
  const salone = page.locator('#page-tapparelle .tapp-card[data-tapp="cover.salone"]');
  await expect(consiglio(salone)).toHaveCount(0);
});

test("con l'aria di fuori peggio di quella di dentro, la finestra tace", async ({
  page,
}, testInfo) => {
  /* La giornata di pioggia: dentro si sta male, ma aprire peggiora. Un
   * igrometro con una soglia sopra direbbe di aprire lo stesso, ed e'
   * esattamente il consiglio sbagliato. */
  const bagno = await avvia(page, testInfo, 88);
  await page.waitForTimeout(600);
  await expect(consiglio(bagno)).toHaveCount(0);
});

test("senza il dato di fuori non si inventa un consiglio", async ({ page }, testInfo) => {
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, typeof STATES === "undefined" ? {} : STATES])
      if (registro["sensor.meteo_umidita"]) registro["sensor.meteo_umidita"].state = "unavailable";
    window.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  /* Un consiglio dato a meta' e' peggio di nessun consiglio, perche' sembra
   * completo: senza il dato di fuori la riga sparisce. */
  await expect(consiglio(bagno)).toHaveCount(0, { timeout: 15_000 });
});

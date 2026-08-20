/* Nel Report convivevano due stili di icona.
 *
 * Le voci riconosciute come elettrodomestici del catalogo prendevano il disegno
 * di Elettrodomestici; tutte le altre — un carico secondario chiamato
 * "Wallbox", una voce aggiunta a mano — restavano con la faccina che il runtime
 * stampa. Nello stesso elenco, uno sopra l'altro, un disegno e un'emoji.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "a1",
        name: "Lavatrice",
        type: "lavatrice",
        visual_key: "lavatrice",
        total_energy_entity: "sensor.e1",
      },
      // Un nome che il catalogo non riconosce: prima restava con la faccina.
      { id: "a2", name: "Zangola", type: "", total_energy_entity: "sensor.e2" },
    ],
    loads: [{ id: "l1", name: "Wallbox", icon: "🔌", total_energy_entity: "sensor.e3" }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Un elettrodomestico del catalogo, uno con un nome che il catalogo non
 * conosce, e un carico secondario: prima solo il primo aveva il disegno. */
const RIGHE = [
  { nome: "Lavatrice", sensore: "sensor.e1" },
  { nome: "Zangola", sensore: "sensor.e2" },
  { nome: "Wallbox", sensore: "sensor.e3" },
];

const STATES = ["sensor.e1", "sensor.e2", "sensor.e3"].map((entity_id, index) => ({
  entity_id,
  state: String(10 + index),
  attributes: {
    friendly_name: entity_id,
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  },
}));

test("ogni voce del Report e' disegnata allo stesso modo", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-page-masthead-style")),
    null,
    {
      timeout: 15000,
    },
  );
  await page.evaluate((states) => {
    const raw = eval("_RAW_STATES");
    for (const entry of states) raw[entry.entity_id] = entry;
  }, STATES);

  // Le righe le stampo io con lo stesso stampo del runtime, e con i nomi che
  // stanno nella configurazione: quello che si prova qui e' che cosa ci disegna
  // dentro il modulo, non che il runtime sappia comporle — per quello ci sono
  // gia' le sue prove, e aspettare che si popoli da se' vuol dire aspettare a
  // tempo, che e' come questa prova cadeva in CI e non qui.
  await page.evaluate((righe) => {
    document.querySelector('[data-tab="energy"]')?.click();
    const list = document.getElementById("ed-device-list");
    list.innerHTML = righe
      .map(
        (riga) =>
          `<div class="ed-device-row" onclick="apriStorico(event,'${riga.sensore}','${riga.nome}')">` +
          `<div class="ed-dev-icon" style="background:rgba(14,165,233,0.1);">⚡</div>` +
          `<div class="ed-dev-name">${riga.nome}</div></div>`,
      )
      .join("");
    window.dispatchEvent(new CustomEvent("dashboardmodern:energy-stable", { detail: {} }));
  }, RIGHE);

  const leggi = () =>
    page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("dashboardmodern:energy-stable", { detail: {} }));
      return [...document.querySelectorAll("#ed-device-list .ed-device-row")].map((row) => {
        const icon = row.querySelector(".ed-dev-icon");
        return {
          nome: row.querySelector(".ed-dev-name")?.textContent?.trim(),
          art: icon?.querySelector("svg[viewBox='0 0 96 96']") ? "disegno" : "altro",
          kind: icon?.querySelector("[data-dm-art]")?.dataset?.dmArt || "",
        };
      });
    });

  // Nessuna riga resta con la faccina: tutte portano lo stesso disegno.
  await expect
    .poll(async () => (await leggi()).filter((entry) => entry.art !== "disegno"), {
      timeout: 15_000,
    })
    .toEqual([]);

  const icons = await leggi();
  expect(icons.length).toBe(RIGHE.length);
  // E quella che il catalogo riconosce non diventa generica.
  expect(icons.find((entry) => entry.nome === "Lavatrice")?.kind).toBe("washer");
});

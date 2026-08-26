/* Il popup dell'auto mostrava sempre e solo l'auto attiva.
 *
 * Le linguette dei profili nascono in cima alla pagina Auto. Chi apre la
 * finestra dell'auto — dalla pagina o dal cerchio della Wallbox nel flusso di
 * Energia — non aveva modo di passare all'altra macchina: doveva chiudere,
 * tornare in Auto, cambiare, e riaprire.
 *
 * Non e' una seconda tendina: e' la stessa, disegnata in un secondo posto.
 * Stesso costruttore, stesso ascoltatore; scegliere da qui e' scegliere da li',
 * e la foto la aggiorna chi la aggiornava gia'.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CARS = [
  { id: "ev1", name: "Leapmotor C10", brand: "leapmotor", battery_entity: "sensor.soc" },
  { id: "ev2", name: "Tesla Model 3", brand: "tesla", battery_entity: "sensor.soc" },
];

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: CARS,
    loads: [{ id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb", order: 0 }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.ev_batteria_auto": "sensor.soc", "dm.ev_potenza_wallbox": "sensor.wb" },
  },
  visibility: { home: true, energy: true, ev: true },
};

const STATES = [
  { entity_id: "sensor.soc", state: "62", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.wb", state: "7200", attributes: { unit_of_measurement: "W" } },
];

function tabs(page) {
  return page.evaluate(() => {
    const host = document.querySelector("#ev-popup .dm-vehicle-profile-popup");
    const cards = [...(host?.querySelectorAll(".dm-vehicle-profile-card") || [])];
    return {
      nomi: cards.map((card) => card.querySelector("strong")?.textContent?.trim()),
      attiva: cards.findIndex((card) => card.classList.contains("active")),
      // La striscia sta dentro alla finestra, non oltre il suo bordo.
      sborda: (() => {
        const card = document.querySelector("#ev-popup .ev-popup-card");
        if (!host || !card) return true;
        const dentro = card.getBoundingClientRect();
        const strisce = host.getBoundingClientRect();
        return strisce.right > dentro.right + 1 || strisce.left < dentro.left - 1;
      })(),
    };
  });
}

test("il popup dell'auto porta le linguette dei profili", async ({ page }, testInfo) => {
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
    /* La foto abita nel PROFILO dell'auto, e il popup mostra quella dell'auto
     * scelta. Le due caselle piatte sono solo il disegno di adesso: con due
     * profili una casella scritta a mano non vale piu' niente — mostrarla
     * vorrebbe dire dare a un'auto la foto di chissa' chi. */
    const url = new URL("/legacy/logo.png", location.href).href;
    const cars = JSON.parse(localStorage.getItem("cd_ev_cars") || "[]");
    if (cars.length) {
      cars[0].img = url;
      localStorage.setItem("cd_ev_cars", JSON.stringify(cars));
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATES);

  // Si arriva dal cerchio della Wallbox, che e' il percorso nuovo.
  await page.evaluate(() => document.querySelector('[data-tab="energy"]')?.click());
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const nodes = [...document.querySelectorAll("#page-energy [data-dm-flow-node]")];
    nodes
      .find((node) => /wallbox/i.test(node.querySelector(".node-label")?.textContent || ""))
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  await expect
    .poll(() => tabs(page), { timeout: 15_000 })
    .toEqual({
      nomi: CARS.map((car) => car.name),
      attiva: 0,
      sborda: false,
    });

  // La foto e' quella della configurazione, non un segnaposto del popup.
  const foto = await page.getAttribute("#ev-new-car-img", "src");
  expect(foto).toContain("/legacy/logo.png");

  // Scegliere dalla finestra sceglie davvero, e la finestra resta aperta.
  await page.evaluate(async () => {
    const cards = [
      ...document.querySelectorAll("#ev-popup .dm-vehicle-profile-popup .dm-vehicle-profile-card"),
    ];
    cards[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  await expect.poll(() => tabs(page).then((value) => value.attiva), { timeout: 15_000 }).toBe(1);
  expect(
    await page.evaluate(() => document.getElementById("ev-popup").classList.contains("show")),
  ).toBe(true);
  expect(await page.evaluate(() => Number(localStorage.getItem("cd_ev_car_active")))).toBe(1);
});

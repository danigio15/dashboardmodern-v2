/* Il cerchio della Wallbox e' l'auto.
 *
 * Toccando quel cerchio nel flusso di Energia si apriva lo storico di un
 * sensore di potenza: un grafico che dice quanti kW passano nel cavo. Ma il
 * cavo e' attaccato a una macchina di cui la plancia sa gia' tutto — carica,
 * autonomia, stato della presa — e quella e' la risposta che uno cerca.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LOADS = [
  { id: "load-boiler", name: "Boiler", power_entity: "sensor.boiler_power", order: 0 },
  { id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb_power", order: 1 },
];

function seed(withCar) {
  return {
    schema_version: 4,
    sections: {
      rooms: [],
      cameras: [],
      appliances: [],
      loads: LOADS,
      lights: [],
      climate: [],
      ev: [],
      covers: [],
      pool: {},
      irrigation: { zones: [] },
      energy: {},
      entityOverrides: withCar
        ? { "dm.ev_batteria_auto": "sensor.soc", "dm.ev_potenza_wallbox": "sensor.wb_power" }
        : {},
    },
    visibility: { home: true, energy: true, ev: true },
  };
}

const STATES = [
  {
    entity_id: "sensor.boiler_power",
    state: "800",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.wb_power",
    state: "7200",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.soc",
    state: "62",
    attributes: { unit_of_measurement: "%", friendly_name: "Batteria auto" },
  },
];

async function boot(page, testInfo, withCar) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed(withCar));
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
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATES);
  await page.evaluate(() => document.querySelector('[data-tab="energy"]')?.click());
  await page.waitForTimeout(1800);
}

function wallboxCircle(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("#page-energy [data-dm-flow-node]")];
    const node = nodes.find((item) =>
      /wallbox/i.test(item.querySelector(".node-label")?.textContent || ""),
    );
    if (!node) return null;
    return { id: node.dataset.dmFlowNode, click: node.dataset.dmFlowClick };
  });
}

test("il cerchio della Wallbox apre il popup dell'auto", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await boot(page, testInfo, true);

  const circle = await wallboxCircle(page);
  expect(circle, "il cerchio della Wallbox e' nel flusso").not.toBeNull();
  expect(circle.click).toBe("ev:");

  const opened = await page.evaluate(async () => {
    document.getElementById("ev-popup")?.classList.remove("show");
    const nodes = [...document.querySelectorAll("#page-energy [data-dm-flow-node]")];
    nodes
      .find((item) => /wallbox/i.test(item.querySelector(".node-label")?.textContent || ""))
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const popup = document.getElementById("ev-popup");
    return {
      shown: popup?.classList.contains("show"),
      // Il popup riprende i dati della vettura: la carica arriva dalla sua
      // entita', non da un numero scritto a mano.
      soc: [...popup.querySelectorAll(".v-ev-soc-txt")].map((node) => node.textContent.trim()),
    };
  });
  expect(opened.shown).toBe(true);
  expect(opened.soc.length).toBeGreaterThan(0);
  expect(opened.soc.every((value) => value === "62%")).toBe(true);
});

test("senza un'auto configurata il cerchio resta lo storico", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await boot(page, testInfo, false);
  const circle = await wallboxCircle(page);
  expect(circle).not.toBeNull();
  // Meglio un grafico che una finestra vuota.
  expect(circle.click).toBe("history:sensor.wb_power");
});

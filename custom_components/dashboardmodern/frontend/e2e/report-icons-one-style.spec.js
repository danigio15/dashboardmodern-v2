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

  const icons = await page.evaluate(async () => {
    document.querySelector('[data-tab="energy"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    eval("cdRebuildReportDevices")();
    // La lista si scrive da sola quando il Report viene disegnato; qui basta
    // che le righe esistano, quindi le stampo con lo stesso stampo del runtime.
    const list = document.getElementById("ed-device-list");
    const devices = eval("ED_DEVICES") || [];
    list.innerHTML = devices
      .map(
        (device) =>
          `<div class="ed-device-row" onclick="apriStorico(event,'${device.sensor}','${device.name}')">` +
          `<div class="ed-dev-icon" style="background:${device.bg};">${device.icon}</div>` +
          `<div class="ed-dev-name">${device.name}</div></div>`,
      )
      .join("");
    // La passata parte da sola quando qualcosa cambia nel Report.
    window.dispatchEvent(new CustomEvent("dashboardmodern:energy-stable", { detail: {} }));
    await new Promise((resolve) => setTimeout(resolve, 700));
    return [...list.querySelectorAll(".ed-device-row")].map((row) => {
      const icon = row.querySelector(".ed-dev-icon");
      return {
        name: row.querySelector(".ed-dev-name")?.textContent?.trim(),
        art: icon?.querySelector("svg[viewBox='0 0 96 96']") ? "disegno" : "altro",
        kind: icon?.querySelector("[data-dm-art]")?.dataset?.dmArt || "",
      };
    });
  });

  expect(icons.length).toBeGreaterThan(2);
  // Nessuna riga resta con la faccina: tutte portano lo stesso disegno.
  expect(icons.filter((entry) => entry.art !== "disegno")).toEqual([]);
  // E quella che il catalogo riconosce non diventa generica.
  expect(icons.find((entry) => entry.name === "Lavatrice")?.kind).toBe("washer");
});

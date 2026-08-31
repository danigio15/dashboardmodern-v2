/* Il cerchio del flusso riempito dagli elettrodomestici, sul documento vero.
 *
 * «Selezionando elettrodomestici nei Carichi i flussi si creano ma senza
 * valore; il popup dello stesso elettrodomestico mostra i valori corretti»:
 * l'apparecchio del mondo vecchio porta solo `entities: [...]`, e il cerchio
 * ora gli fa la stessa domanda del popup — la prima entita' in watt. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "frigo",
        name: "Frigorifero",
        type: "frigo",
        entities: ["switch.frigo", "sensor.frigo_w"],
        metadata: { beta27_subload_group: "cerchio-cucina" },
      },
    ],
    loads: [{ id: "cerchio-cucina", name: "Cucina", icon: "🍳", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

test("il cerchio degli elettrodomestici porta i loro watt", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const letture = {
      "sensor.frigo_w": "312",
      "switch.frigo": "on",
      "sensor.rete_w": "900",
      "sensor.casa_w": "1200",
    };
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.waitForTimeout(1500);
  const bolla = await page.evaluate(() =>
    [...document.querySelectorAll("#page-energy [data-dm-flow-node]")].map((nodo) => ({
      nome: (nodo.querySelector(".node-label")?.textContent || "").trim(),
      valore: (nodo.querySelector(".node-value")?.textContent || nodo.textContent || "").trim(),
    })),
  );
  expect(bolla.some((b) => b.nome === "Cucina" && /312/.test(b.valore))).toBe(true);
});

/* «È possibile inserire un solo pneumatico, spero al prossimo rilascio sia
 * possibile inserirne 4» (#319).
 *
 * Due prove, una per motore. Sull'auto elettrica il quadro termico non si
 * disegna — e finora si portava via anche le gomme, che con il motore non
 * c'entrano niente: chi ha un'elettrica compilava le caselle e non le vedeva.
 * Sulla termica il quadretto sta sotto le altre misure, dove stava la casella
 * sola di prima.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
    energy: {},
    entityOverrides: {},
  },
  visibility: { ev: true },
};

/* Le quattro gomme come le pubblica un TPMS, con la posteriore destra a terra. */
const GOMME = [
  { entity_id: "sensor.gomma_as", state: "2.4", attributes: { unit_of_measurement: "bar" } },
  { entity_id: "sensor.gomma_ad", state: "2.4", attributes: { unit_of_measurement: "bar" } },
  { entity_id: "sensor.gomma_ps", state: "2.3", attributes: { unit_of_measurement: "bar" } },
  { entity_id: "binary_sensor.gomma_pd", state: "on", attributes: {} },
];

const MAPPA = {
  "dm.ev_pneumatico_ant_sx": "sensor.gomma_as",
  "dm.ev_pneumatico_ant_dx": "sensor.gomma_ad",
  "dm.ev_pneumatico_post_sx": "sensor.gomma_ps",
  "dm.ev_pneumatico_post_dx": "binary_sensor.gomma_pd",
};

async function boot(page, testInfo, tipo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((gomme) => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = gomme;
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
  }, GOMME);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => Boolean(eval("_RAW_STATES")["sensor.gomma_as"]));
  await page.evaluate(
    ({ mappa, tipo }) => {
      localStorage.setItem(
        "cd_ev_cars",
        JSON.stringify([{ uid: "auto-1", name: "La mia", tipo, ov: mappa }]),
      );
      localStorage.setItem("cd_ev_car_active", "0");
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { mappa: MAPPA, tipo },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

const ruote = (page) =>
  page
    .locator("#page-ev .dm-termica-gomme-quadro .dm-termica-gomma")
    .evaluateAll((nodi) => nodi.map((nodo) => nodo.textContent.replace(/\s+/g, " ").trim()));

test.describe("le quattro gomme", () => {
  test("l'auto elettrica le vede, anche senza quadro termico", async ({ page }, testInfo) => {
    await boot(page, testInfo, "");
    await expect(page.locator("#page-ev .dm-termica")).toHaveAttribute("data-solo-gomme", "true");
    /* Quattro posti, nell'ordine in cui stanno sull'auto. */
    await expect.poll(() => ruote(page)).toHaveLength(4);
    const testi = await ruote(page);
    expect(testi[0]).toContain("2,4");
    expect(testi[2]).toContain("2,3");
    /* La ruota che si lamenta lo dice, e l'auto chiede attenzione. */
    expect(testi[3]).toMatch(/controllare|Da controllare|Check/i);
    await expect(page.locator("#page-ev .dm-termica")).toHaveAttribute("data-attenzione", "true");
    /* E il quadro del motore non c'e': quello resta delle auto a carburante. */
    await expect(page.locator("#page-ev .dm-termica-quadro")).toHaveCount(0);
  });

  test("l'auto a benzina le vede sotto le sue misure", async ({ page }, testInfo) => {
    await boot(page, testInfo, "termica");
    await expect(page.locator("#page-ev .dm-termica")).toHaveAttribute("data-solo-gomme", "false");
    await expect.poll(() => ruote(page)).toHaveLength(4);
    /* Il quadro del motore resta dov'era, con le gomme sotto. */
    await expect(page.locator("#page-ev .dm-termica-quadro")).toHaveCount(1);
  });
});

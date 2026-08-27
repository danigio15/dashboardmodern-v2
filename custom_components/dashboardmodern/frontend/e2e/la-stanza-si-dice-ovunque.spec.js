/* La stanza si puo' dire su qualunque entita', non solo dove la scheda la chiede.
 *
 * Luci, clima, tapparelle, elettrodomestici, telecamere, carichi, robot e zone
 * d'irrigazione la stanza ce l'hanno addosso. Tutto il resto — una sonda, un
 * sensore di allagamento, la finestra di un avviso — non ce l'aveva, e la
 * pagina di una stanza ne raccontava meta'.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "🛋️" },
      { id: "room-bagno", name: "Bagno", icon: "🚿" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [
      {
        id: "cover-salone",
        name: "Tapparella salone",
        entity: "cover.salone",
        room_id: "room-salone",
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.boiler_pompa_solare": "sensor.pompa_solare" },
  },
  visibility: { home: true, stanze: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["sensor.pompa_solare"] = {
      entity_id: "sensor.pompa_solare",
      state: "42",
      attributes: { friendly_name: "Pompa solare", unit_of_measurement: "°C" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
}

test.describe("la stanza, ovunque", () => {
  test("una casella del solare termico puo' dire in che stanza sta", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="sez3"]').click();
    const tendina = page.locator('#ed-body .ed-slot [data-dm-room-entity="sensor.pompa_solare"]');
    await expect(tendina).toHaveCount(1);
    // Le stanze configurate ci sono tutte, piu' la voce che dice «nessuna».
    await expect(tendina.locator("option")).toHaveCount(3);
    await tendina.selectOption("room-salone");
    await expect
      .poll(() =>
        page.evaluate(() => {
          try {
            return JSON.parse(localStorage.getItem("cd_stanze_entita") || "{}");
          } catch (_errore) {
            return {};
          }
        }),
      )
      .toEqual({ "sensor.pompa_solare": "room-salone" });
  });

  test("assegnata, compare nella pagina di quella stanza", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_stanze_entita",
        JSON.stringify({ "sensor.pompa_solare": "room-salone" }),
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-stanze")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    const salone = page.locator('#page-stanze [data-dm-stanza="room-salone"]');
    await expect(salone).toHaveCount(1);
    // Il Salone e' gia' la linguetta scelta: e' la prima.
    await expect(salone).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#page-stanze")).toContainText("Pompa solare");
    // E nell'altra stanza no: una cosa sta dove l'hai messa.
    await page
      .locator('#page-stanze [data-dm-stanza="room-bagno"]')
      .evaluate((nodo) => nodo.click());
    await expect(page.locator("#page-stanze")).not.toContainText("Pompa solare");
  });
});

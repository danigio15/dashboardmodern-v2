/* L'interruttore che dice se un'entita' va nella tessera della Home.
 *
 * Stava solo sulle righe che mostrano l'entity_id scritto sotto il nome —
 * luci, tapparelle, elettrodomestici — e saltava tutte le sezioni fatte a
 * caselle: EV, solare termico, MiniPC, antifurto. Sono proprio quelle con
 * dieci sensori di cui in Home ne interessano due.
 *
 * E diceva solo «In Home», che dice dove ma non cosa: adesso dice se questa
 * entita' e' dentro la tessera o ne sta fuori.
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
    ev: [{ id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10", ov: {} }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {
      "dm.ev_batteria_auto": "sensor.batteria_auto",
      "dm.boiler_pompa_solare": "sensor.pannello_solare",
    },
  },
  visibility: { home: true, ev: true },
};

async function apriScheda(page, testInfo, tab) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["sensor.batteria_auto"] = {
      entity_id: "sensor.batteria_auto",
      state: "72",
      attributes: { friendly_name: "Batteria auto", unit_of_measurement: "%" },
    };
    raw["sensor.pannello_solare"] = {
      entity_id: "sensor.pannello_solare",
      state: "48",
      attributes: { friendly_name: "Pannello solare", unit_of_measurement: "°C" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator(`.ed-tab[data-tab="${tab}"]`).click();
  await expect(page.locator("#ed-body .ed-slot").first()).toBeVisible();
}

test.describe("l'interruttore dei widget", () => {
  test("c'e' anche nella scheda EV, che e' fatta a caselle", async ({ page }, testInfo) => {
    await apriScheda(page, testInfo, "sez2");
    const interruttore = page.locator("#ed-body .ed-slot [data-dm-widget-entities]");
    await expect(interruttore.first()).toBeVisible();
    // Solo sulle caselle che un'entita' ce l'hanno davvero: una casella vuota
    // non ha niente da mettere o togliere dalla Home.
    const quanti = await interruttore.count();
    expect(quanti).toBeGreaterThan(0);
    expect(await interruttore.first().getAttribute("data-dm-widget-entities")).toBe(
      "sensor.batteria_auto",
    );
  });

  test("dice cosa fa, e cambia parola quando cambia stato", async ({ page }, testInfo) => {
    await apriScheda(page, testInfo, "sez2");
    const interruttore = page.locator("#ed-body .ed-slot [data-dm-widget-entities]").first();
    await expect(interruttore).toHaveAttribute("data-on", "true");
    await expect(interruttore.locator("b")).toHaveText(/widget/i);
    await expect(interruttore).toHaveAttribute("title", /tessera della Home/i);
    await interruttore.click();
    await expect(interruttore).toHaveAttribute("data-on", "false");
    await expect(interruttore.locator("b")).toHaveText(/fuori/i);
    await expect(interruttore).toHaveAttribute("title", /non entra/i);
  });

  test("la scelta resta scritta dove la legge la Home", async ({ page }, testInfo) => {
    await apriScheda(page, testInfo, "sez2");
    await page.locator("#ed-body .ed-slot [data-dm-widget-entities]").first().click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          try {
            return JSON.parse(localStorage.getItem("cd_widgets") || "{}").excluded || [];
          } catch (_errore) {
            return [];
          }
        }),
      )
      .toContain("sensor.batteria_auto");
  });

  test("c'e' anche nel solare termico", async ({ page }, testInfo) => {
    await apriScheda(page, testInfo, "sez3");
    await expect(
      page.locator('#ed-body .ed-slot [data-dm-widget-entities="sensor.pannello_solare"]'),
    ).toHaveCount(1);
  });
});

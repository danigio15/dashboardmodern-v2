/* La card del Clima si puo' girare: grande l'ambiente, sotto il target.
 *
 * Dal campo: «flag per invertire i dati della card — target sotto al posto
 * di ambiente, ambiente sopra al posto di target». Senza flag la card resta
 * com'e' sempre stata; col flag numeri E didascalie si scambiano di posto.
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
    climate: [{ id: "c1", name: "Salone", entity: "climate.salone", type: "clima" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "climate.salone": {
    entity_id: "climate.salone",
    state: "cool",
    attributes: { friendly_name: "Salone", current_temperature: 21.5, temperature: 25 },
  },
};

test("senza flag il target sta grande; col flag salgono i gradi della stanza", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, STATI);

  /* Le card abitano la pagina Clima. */
  await page.evaluate(() => document.querySelector('.tab[data-tab="clima"]')?.click());
  const card = page.locator('[data-dm-cl="climate.salone"]').first();
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card.locator("[data-dm-cl-target]")).toContainText("25", { timeout: 10000 });
  await expect(card.locator(".dm-cl-cap")).toContainText(/Target/i);
  await expect(card.locator("[data-dm-cl-ambient]")).toContainText("21.5");

  await page.evaluate(() => {
    window.localStorage.setItem("cd_clima_inverti_card", "1");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(card.locator("[data-dm-cl-target]")).toContainText("21.5", { timeout: 10000 });
  await expect(card.locator(".dm-cl-cap")).toContainText(/Ambiente|Room/i);
  await expect(card.locator("[data-dm-cl-ambient]")).toContainText("25");
});

/* La finestra aperta di una tessera si aggiorna senza tremare.
 *
 * «Ricomparso il tremolio»: il corpo del popup veniva buttato via e
 * riscritto (innerHTML) a ogni valore che cambiava — ogni due secondi su
 * una casa viva — e con lui se ne andavano il punto di scorrimento e i nodi
 * sotto il dito. Quando la forma non cambia, ora si travasano solo testi e
 * attributi nei nodi che ci sono gia'.
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

function statoClima(gradi) {
  return {
    "climate.salone": {
      entity_id: "climate.salone",
      state: "heat",
      last_changed: new Date(Date.now() - 3600e3).toISOString(),
      attributes: { friendly_name: "Clima Salone", current_temperature: gradi, temperature: 22 },
    },
  };
}

test("il valore nuovo entra nei nodi che ci sono gia'", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  const semina = async (gradi) => {
    await page.evaluate((extra) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...extra } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, extra);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    }, statoClima(gradi));
  };
  await semina(20.5);
  await page.waitForTimeout(1800);

  await page.evaluate(() => {
    document.querySelector('#dm-widgets [data-dm-widget="clima"]')?.click();
  });
  const corpo = page.locator("#dm-widget-popup .dm-w-body");
  await expect(corpo).toBeVisible({ timeout: 10000 });
  await expect(corpo.locator(".dm-w-name small").first()).toContainText("20", { timeout: 10000 });

  /* Si firma il nodo vivo: se la riscrittura lo butta via, la firma muore. */
  await page.evaluate(() => {
    const riga = document.querySelector("#dm-widget-popup .dm-w-body .dm-w-row");
    if (riga) riga.__dmSegno = "vivo";
  });

  await semina(23.5);
  await expect(corpo.locator(".dm-w-name small").first()).toContainText("23", { timeout: 10000 });

  const segno = await page.evaluate(
    () => document.querySelector("#dm-widget-popup .dm-w-body .dm-w-row")?.__dmSegno,
  );
  expect(segno).toBe("vivo");
});

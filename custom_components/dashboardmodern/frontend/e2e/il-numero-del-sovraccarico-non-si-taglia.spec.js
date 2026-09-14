/* Il numero è il motivo per cui l'avviso esiste.
 *
 * L'avviso del sovraccarico sta accanto alla fascia sotto il meteo, e sul
 * telefono si stringe per lasciarle spazio: il tetto è il 46% della riga. Ma
 * su uno schermo da 360 pixel il 46% sono 165, e tolti il disegno, lo spazio
 * fra i due e i bordi ne restano 116 per «9,50 kW / 7,00 kW», che ne vuole
 * 135. La misura finiva nei puntini — spariva cioè proprio la cosa che l'avviso
 * era lì a dire, mentre la parolina sotto, che ha una deriva apposta per
 * questo, restava intera.
 *
 * Qui si guarda quello che si vede davvero, alle larghezze dei telefoni veri.
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
    energy: { house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const avviso = (page) => page.locator("#dm-soglia-allerta");
const misura = (page) => avviso(page).locator(".dm-casa-testa");

test("la misura del sovraccarico resta intera alle larghezze dei telefoni", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const mappa = { "dm.energy_potenza_consumo_casa": "sensor.casa_w" };
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
    localStorage.setItem(
      "cd_energia_soglia",
      JSON.stringify({ sorgente: "casa", ambra: 7000, rossa: 7000 }),
    );
    const stati = eval("_RAW_STATES");
    stati["sensor.casa_w"] = {
      entity_id: "sensor.casa_w",
      state: "9500",
      attributes: { unit_of_measurement: "W", friendly_name: "Consumo casa" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });

  await expect(avviso(page)).toHaveCount(1);
  await expect(misura(page)).toContainText("/");

  /* Un iPhone SE, un telefono medio, uno grande: il 46% è sotto la misura su
   * tutti e tre, ed è lì che si vedeva sparire il numero. */
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 780 });
    await expect
      .poll(() => misura(page).evaluate((nodo) => nodo.scrollWidth - nodo.clientWidth), {
        message: `a ${width}px la misura deve starci tutta`,
      })
      .toBeLessThanOrEqual(1);
  }

  /* E la fascia accanto resta: l'avviso prende quello che gli serve, non tutta
   * la riga. La parolina sotto, che può derivare, è quella che cede. */
  await page.setViewportSize({ width: 360, height: 780 });
  const larghezze = await page.evaluate(() => {
    const corsia = document.getElementById("dm-casa-fascia");
    const pastiglia = document.getElementById("dm-soglia-allerta");
    return {
      corsia: Math.round(corsia.getBoundingClientRect().width),
      pastiglia: Math.round(pastiglia.getBoundingClientRect().width),
    };
  });
  expect(larghezze.pastiglia).toBeLessThan(larghezze.corsia);
});

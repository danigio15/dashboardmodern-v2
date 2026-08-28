/* La finestra della pagina Clima offre le modalita' che l'unita' accetta.
 *
 * Nel guscio le modalita' sono cinque, scritte a mano: freddo, caldo, ventola,
 * secco, auto — le stesse per tutti, e nascoste in blocco quando il nome
 * dell'entita' contiene la parola «termosifone». Un tasto che l'unita' non sa
 * eseguire e' peggio di un tasto che non c'e', e una pompa di calore chiamata
 * in un altro modo restava senza modalita' del tutto.
 *
 * Il pannello della tessera quelle cose le sa gia': legge `hvac_modes` e
 * `fan_modes` dell'unita' aperta. Adesso e' lui a stare nella finestra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      {
        id: "c1",
        name: "Pompa Salone",
        entity: "climate.pompa",
        room: "room-salone",
        type: "pompa",
      },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
};

test("nella finestra ci sono solo le modalita' dell'unita' aperta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["climate.pompa"] = {
      entity_id: "climate.pompa",
      state: "heat",
      attributes: {
        friendly_name: "Pompa Salone",
        /* Questa unita' sa fare due cose sole: scaldare e spegnersi. */
        hvac_modes: ["off", "heat"],
        fan_modes: ["low", "high"],
        fan_mode: "low",
        current_temperature: 20.5,
        temperature: 22,
        min_temp: 5,
        max_temp: 35,
        target_temp_step: 0.5,
      },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1400);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.evaluate(() => window.apriClimaPopup?.("climate.pompa", null));
  const pannello = page.locator("#clima-popup-overlay [data-dm-cl-panel] .dm-w-panel");
  await expect(pannello).toBeVisible();

  const modi = await page
    .locator("#clima-popup-overlay [data-dm-cl-panel] [data-dm-w-mode]")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWMode));
  expect(modi.sort()).toEqual(["heat", "off"]);

  const ventole = await page
    .locator("#clima-popup-overlay [data-dm-cl-panel] [data-dm-w-fan]")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWFan));
  expect(ventole.sort()).toEqual(["high", "low"]);

  // E le cinque modalita' scritte a mano nel guscio non si vedono piu'.
  await expect(page.locator("#cp-mode-section")).toBeHidden();
  await expect(page.locator("#cp-fan-section")).toBeHidden();

  // E in cima c'e' il nome scelto, non il pezzo dopo il punto dell'entita'.
  await expect(page.locator("#cp-name")).toHaveText("Pompa Salone");
  await expect(page.locator("#cp-room")).toContainText("Salone");

  // I tasti comandano davvero: li ascolta il giro dei widget, sul documento.
  await page.evaluate(() => {
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push({ dominio, servizio, dati });
      return Promise.resolve(true);
    };
  });
  await page.locator('#clima-popup-overlay [data-dm-w-mode="off"]').click();
  expect(await page.evaluate(() => window.__chiamate)).toContainEqual({
    dominio: "climate",
    servizio: "set_hvac_mode",
    dati: { entity_id: "climate.pompa", hvac_mode: "off" },
  });
});

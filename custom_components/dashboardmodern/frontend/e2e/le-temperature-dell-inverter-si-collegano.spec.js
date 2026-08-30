/* «Manca la parte nel config per configurare le entita' di questa parte, sia
 * le temperature inverter che le ventole. Va inserito nella parte
 * impostazioni di energia.»
 *
 * La scheda Temperature di Energia legge cinque alias che nessuna maschera
 * sapeva riempire. Qui si prova la strada intera sul documento vero: editor →
 * Energia → IMPOSTAZIONI → i cinque campi ci sono, e compilarne uno accende
 * l'alias che la scheda legge.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
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
  visibility: { home: true },
};

test("le temperature dell'inverter e la ventola si collegano dalle impostazioni di Energia", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => window.apriConfigEntita());
  await page.locator(".ed-tab[data-tab='sez1']").click();

  /* Il gesto in UN turno di thread: la lezione del banco del ritratto. */
  await page
    .locator("#editor-modal .ed-inner-tab", { hasText: "IMPOSTAZIONI" })
    .evaluate((nodo) => {
      nodo.scrollIntoView({ block: "center" });
      nodo.click();
    });

  /* I cinque campi della scheda Temperature, nel pannello impostazioni. */
  const carta = page.locator("#editor-modal [data-energy-cooling]");
  await expect(carta).toBeVisible({ timeout: 20000 });
  for (const campo of [
    "inverter_ac_temperature",
    "inverter_dc_temperature",
    "battery_temperature",
    "fan_power",
    "fan_switch",
  ])
    await expect(carta.locator(`#dm-energy-cooling-${campo}`)).toBeAttached();

  /* Compilare un campo accende l'alias che la scheda Temperature legge. */
  await carta.locator("#dm-energy-cooling-inverter_ac_temperature").evaluate((input) => {
    input.value = "sensor.temp_inverter_ac_di_prova";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            return (
              JSON.parse(window.localStorage.getItem("cd_entity_overrides") || "{}")[
                "dm.energy_temperatura_ac_inverter"
              ] || ""
            );
          } catch {
            return "";
          }
        }),
      { timeout: 20000 },
    )
    .toBe("sensor.temp_inverter_ac_di_prova");
});

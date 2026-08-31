/* La mappatura del meteo mostra solo l'entita' weather, finche' non si
 * chiede di piu'.
 *
 * Dal campo: «non mostrare tutte le entita'; un flag "usa entita' proprie"
 * mostra i campi, altrimenti default sull'entita' weather». I cinque campi
 * della stazione stanno dietro la casella; chi li aveva gia' mappati la
 * trova accesa da sola.
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
  visibility: { home: true },
};

async function apriMappaturaHome(page) {
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("sezioni"));
  const slotMeteo = page.locator('input[data-ref="dm.home_meteo"]');
  await expect(slotMeteo).toBeAttached({ timeout: 20000 });
  /* La fisarmonica va aperta, o i campi non si vedono comunque. */
  await page.evaluate(() => {
    const slot = document.querySelector('input[data-ref="dm.home_meteo"]');
    const acc = slot?.closest("details.ed-acc");
    if (acc) acc.open = true;
  });
}

test("senza flag i cinque campi della stazione stanno nascosti", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await apriMappaturaHome(page);

  /* Le caselle grezze sono rivestite da un altro strato: quello che conta
   * e' la RIGA (.ed-slot), che col flag spento porta hidden. */
  const rigaNascosta = (ref) =>
    page
      .locator(`input[data-ref="${ref}"]`)
      .evaluate((input) => input.closest(".ed-slot")?.hidden === true);
  await expect(page.locator("[data-dm-meteo-flag]")).toBeAttached({ timeout: 10000 });
  expect(await rigaNascosta("dm.home_meteo_temperatura")).toBe(true);
  expect(await rigaNascosta("dm.home_meteo_vento")).toBe(true);
  /* L'entita' weather resta in vista: e' lei il default. */
  expect(await rigaNascosta("dm.home_meteo")).toBe(false);

  /* Accendendo la casella i campi compaiono. */
  await page.evaluate(() => {
    const casella = document.querySelector("[data-dm-meteo-flag] input");
    casella.checked = true;
    casella.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect
    .poll(async () => rigaNascosta("dm.home_meteo_temperatura"), { timeout: 10000 })
    .toBe(false);
});

test("chi aveva gia' mappato la stazione trova la casella accesa", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_entity_overrides",
      JSON.stringify({ "dm.home_meteo_temperatura": "sensor.stazione_temp" }),
    );
  });
  await apriMappaturaHome(page);
  await expect(page.locator("[data-dm-meteo-flag] input")).toBeChecked({ timeout: 10000 });
  expect(
    await page
      .locator('input[data-ref="dm.home_meteo_temperatura"]')
      .evaluate((input) => input.closest(".ed-slot")?.hidden === true),
  ).toBe(false);
});

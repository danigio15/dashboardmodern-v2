/* Il blocco «Si vede ma non si comanda» della presa SI SALVA davvero.
 *
 * Dal campo: «se lo flag e salvo non prende opzione e presa continua ad
 * essere comandata». Il salvataggio passava da `root.dmSegnaSoloLettura?.()`
 * — un nome che nessuno ha mai messo su root — e l'optional chaining faceva
 * no-op in silenzio: la casella tornava vuota e la presa restava comandabile.
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

test("la casella spuntata finisce in cd_solo_lettura, e tolta se ne va", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_prese",
      JSON.stringify([
        { id: "presa-1", name: "Frog", entity: "switch.frog", icon: "🔌", room_id: "" },
      ]),
    );
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("prese"));
  await expect(page.locator("[data-presa-index]").first()).toBeAttached({ timeout: 20000 });

  const salvaBloccata = async (spuntata) => {
    await page.locator('[data-presa-index="0"] [data-presa-edit]').click();
    await expect(page.locator("#ed-presa-lock")).toBeAttached({ timeout: 10000 });
    await page.evaluate((valore) => {
      const casella = document.getElementById("ed-presa-lock");
      casella.checked = valore;
    }, spuntata);
    await page.locator("[data-presa-save]").click();
    await page.waitForTimeout(300);
    return page.evaluate(() => JSON.parse(window.localStorage.getItem("cd_solo_lettura") || "{}"));
  };

  /* Spuntata: la presa entra fra le cose che si guardano e basta. */
  await expect
    .poll(async () => (await salvaBloccata(true))["switch.frog"], { timeout: 10000 })
    .toBe(true);
  /* E la casella riaperta si RITROVA spuntata: prima tornava vuota. */
  await page.locator('[data-presa-index="0"] [data-presa-edit]').click();
  await expect(page.locator("#ed-presa-lock")).toBeChecked({ timeout: 10000 });
  await page.locator("[data-presa-cancel]").click();

  /* Tolta: il blocco se ne va. */
  const dopo = await salvaBloccata(false);
  expect("switch.frog" in dopo).toBe(false);
});

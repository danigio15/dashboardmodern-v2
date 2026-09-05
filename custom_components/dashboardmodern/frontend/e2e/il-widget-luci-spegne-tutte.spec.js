/* «Sul widget luci metterei anche spegni tutte» (#315).
 *
 * Chi ha sette luci accese e le vuole spegnere tutte deve toccare sette
 * interruttori, oppure tenersi un comando rapido a parte — che e' proprio
 * quello che chi l'ha chiesto voleva togliere: «così lo tolgo dai Comandi
 * Rapidi ed è tutto dentro la tessera».
 *
 * Il tasto compare solo quando c'e' qualcosa da spegnere, spegne ogni luce col
 * servizio del suo dominio — una luce puo' essere un `light`, uno `switch` o
 * un `input_boolean` — e le protette non le tocca.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salotto", name: "Salotto", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { entity: "light.salotto", name: "Salotto", room_id: "room-salotto" },
      { entity: "light.cucina", name: "Cucina" },
      /* Una luce che non e' una `light`: e' il caso per cui un solo
       * `light.turn_off` ne lascerebbe indietro la meta'. */
      { entity: "switch.lampada_studio", name: "Studio" },
      { entity: "light.camera", name: "Camera" },
    ],
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

async function boot(page, testInfo, accese) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((quali) => {
    const stati = eval("_RAW_STATES");
    for (const id of ["light.salotto", "light.cucina", "switch.lampada_studio", "light.camera"])
      stati[id] = {
        entity_id: id,
        state: quali.includes(id) ? "on" : "off",
        attributes: { friendly_name: id },
      };
    /* I comandi non escono di casa: si contano. */
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__comandi.push(`${dominio}.${servizio} ${dati?.entity_id || ""}`);
      return Promise.resolve(true);
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, accese);
  await page.waitForTimeout(1200);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]').click();
  await expect(page.locator("#dm-widget-popup")).toBeVisible();
}

test("il tasto spegne tutte le luci accese, ognuna col suo servizio", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, ["light.salotto", "light.cucina", "switch.lampada_studio"]);

  const tasto = page.locator("#dm-widget-popup [data-dm-w-lights-off]");
  await expect(tasto).toBeVisible();
  /* Dice quante ne spegnera'. */
  await expect(tasto.locator("b")).toHaveText("3");

  await tasto.click();
  const comandi = await page.evaluate(() => window.__comandi.slice().sort());
  expect(comandi).toEqual([
    "light.turn_off light.cucina",
    "light.turn_off light.salotto",
    /* La lampada su interruttore si spegne da `switch`, non da `light`. */
    "switch.turn_off switch.lampada_studio",
  ]);
  /* Quella gia' spenta non si tocca: non e' un comando in piu' da mandare. */
  expect(comandi.join(" ")).not.toContain("light.camera");
});

test("con una luce sola accesa il tasto non compare", async ({ page }, testInfo) => {
  /* Il suo interruttore e' li' accanto: una riga di tasti che ne duplica un
   * altro e' rumore, non una comodita'. */
  await boot(page, testInfo, ["light.salotto"]);
  await expect(page.locator("#dm-widget-popup [data-dm-w-lights-off]")).toHaveCount(0);
});

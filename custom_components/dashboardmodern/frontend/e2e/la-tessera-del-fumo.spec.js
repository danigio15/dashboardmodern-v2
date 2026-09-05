/* La tessera di fumo e gas in Home (#328).
 *
 * «Un widget che mostri il numero di sensori fumo e allagamento, e che
 * aprendolo li mostri, oltre che lampeggi e dica quali si sono attivati.»
 *
 * Come l'aria e gli allagamenti non si configura: chi ha un rilevatore in casa
 * se lo ritrova in Home. La differenza rispetto a prima e' che la tessera c'e'
 * anche quando non succede niente, e dice quanti ne sta guardando — una
 * sentinella che si vede solo a disastro avvenuto non permette di accorgersi
 * che ha smesso di guardare.
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
    /* Una luce qualunque: garantisce che la striscia dei widget esista, cosi'
     * l'assenza della tessera del fumo voglia dire qualcosa. */
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

async function boot(page, testInfo, sensori) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((elenco) => {
    const stati = eval("_RAW_STATES");
    stati["light.salotto"] = {
      entity_id: "light.salotto",
      state: "on",
      attributes: { friendly_name: "Salotto" },
    };
    for (const voce of elenco)
      stati[voce.entity_id] = {
        entity_id: voce.entity_id,
        state: voce.state,
        attributes: { friendly_name: voce.name, device_class: voce.device_class },
      };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, sensori);
  await page.waitForTimeout(1200);
}

const CUCINA = {
  entity_id: "binary_sensor.fumo_cucina",
  name: "Fumo cucina",
  device_class: "smoke",
  state: "off",
};
const GARAGE = {
  entity_id: "binary_sensor.gas_garage",
  name: "Gas garage",
  device_class: "gas",
  state: "off",
};
const CALDAIA = {
  entity_id: "binary_sensor.co_caldaia",
  name: "Monossido caldaia",
  device_class: "carbon_monoxide",
  state: "off",
};

test("a casa tranquilla la tessera dice quanti rilevatori sta guardando", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, [CUCINA, GARAGE, CALDAIA]);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="fumo"]');
  await expect(tessera).toBeVisible();
  /* Tre: fumo, gas e monossido. Sono tre classi diverse e contano tutte. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("3");
  await expect(tessera).toContainText("Tutto tranquillo");
  /* A riposo non lampeggia: l'allarme e' una cosa che si accende, non lo
   * sfondo permanente della Home. */
  await expect(tessera).toHaveAttribute("data-alert", "false");

  /* Aperta, li elenca tutti e tre, non solo quelli che suonano. */
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  await expect(finestra).toContainText("Fumo cucina");
  await expect(finestra).toContainText("Gas garage");
  await expect(finestra).toContainText("Monossido caldaia");
});

test("quando uno suona la tessera lo dice per nome e lampeggia", async ({ page }, testInfo) => {
  await boot(page, testInfo, [CUCINA, { ...GARAGE, state: "on" }, CALDAIA]);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="fumo"]');
  await expect(tessera).toBeVisible();
  /* In copertina quanti ne suonano, non quanti ce ne sono: quando c'e'
   * l'allarme il numero che serve e' quello. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("1");
  /* E chi e' — «dica quali si sono attivati» — col suo nome, non l'entity_id. */
  await expect(tessera).toContainText("Gas garage");
  await expect(tessera).not.toContainText("binary_sensor");
  await expect(tessera).toHaveAttribute("data-alert", "true");

  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  /* Chi suona sta in cima, e la sua riga lo dice a parole. */
  const righe = finestra.locator(".dm-w-name");
  await expect(righe.first()).toHaveText("Gas garage");
  await expect(finestra).toContainText("Allarme");
  await expect(finestra).toContainText("Tranquillo");
});

test("senza rilevatori la tessera non c'e'", async ({ page }, testInfo) => {
  /* Una tessera che dice «tutto tranquillo» senza aver letto niente e' peggio
   * di una tessera che non c'e'. */
  await boot(page, testInfo, [
    {
      entity_id: "binary_sensor.porta_ingresso",
      name: "Porta ingresso",
      device_class: "door",
      state: "off",
    },
  ]);
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]')).toBeVisible();
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="fumo"]')).toHaveCount(0);
});

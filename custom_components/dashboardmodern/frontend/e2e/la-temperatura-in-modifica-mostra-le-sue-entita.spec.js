/* Aprendo una temperatura con la matita sparivano le entita' che aveva.
 *
 * Il campo di un'entita' non e' piu' una casella nuda: davanti gli sta la
 * pastiglia che dice quale entita' e' scelta, e la casella vera resta dietro
 * la matita. Chi apre una temperatura in modifica scriveva `input.value` e
 * basta: la pastiglia non riceveva niente e continuava a dire «Scegli
 * entita'» sopra un campo pieno — e il campo, essendo nascosto, non si vedeva
 * nemmeno. Sullo schermo la temperatura sembrava svuotata, e salvarla avrebbe
 * scritto il vuoto: «di fatto non si riesce a modificarla».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "🛋️",
        floor: "Piano terra",
        temp: "sensor.salone_temperature",
        hum: "sensor.salone_humidity",
        metadata: {},
      },
    ],
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
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, temperature: true },
};

test("la matita di una temperatura mostra le entita' che quella temperatura ha", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez7");
  });
  await expect(page.locator("[data-beta25-temperature-editor]")).toBeVisible({ timeout: 15_000 });

  await page.locator("[data-beta25-temperature-edit]").first().click();

  // La casella vera porta il valore: quella non ha mai smesso di funzionare.
  await expect(page.locator("#ed-pl-temp")).toHaveValue("sensor.salone_temperature");
  await expect(page.locator("#dm-humidity-new")).toHaveValue("sensor.salone_humidity");

  // E la pastiglia, che e' quello che si vede, dice la stessa cosa.
  for (const campo of ["#ed-pl-temp", "#dm-humidity-new"]) {
    const ospite = page
      .locator('[data-dm-entity-chip="true"]', { has: page.locator(campo) })
      .first();
    await expect(ospite).toHaveAttribute("data-dm-slot", "mapped");
  }
  const nome = page
    .locator('[data-dm-entity-chip="true"]', { has: page.locator("#ed-pl-temp") })
    .first()
    .locator(".dm-slot-chip [data-chip-name]");
  await expect(nome).toHaveText(/salone_temperature/);
});

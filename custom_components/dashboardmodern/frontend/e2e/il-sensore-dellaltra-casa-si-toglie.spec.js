/* Il travaso già scritto nella configurazione, ripulito.
 *
 * Fermare il difetto non basta: chi ha due impianti ha già dei carichi con il
 * sensore dell'altra casa scritto dentro. Il giro d'avvio lo toglie — ma solo
 * dove si sa dimostrare chi è la copia, e il segno è il contatore che il
 * carico si è tenuto suo. Dove il segno non c'è, non si cancella: la maschera
 * lo dice e mette il gesto in mano a chi sa in quale appartamento sta quel
 * sensore.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const IMPIANTI = {
  name: "Casa sotto",
  grid: { power: "sensor.rete_w" },
  solar: { power: "sensor.fv_w" },
  house: { power: "sensor.casa_w" },
  plants: [
    {
      id: "impianto-2",
      name: "Casa sopra",
      grid: { power: "sensor.rete2_w" },
      solar: { power: "sensor.fv2_w" },
      house: { power: "sensor.casa2_w" },
    },
  ],
  metadata: { plant_seq: 2 },
};

const seme = (loads) => ({
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    loads,
    energy: IMPIANTI,
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

const SPECCHIO = { boiler: { name: "Boiler casa sotto", icon: "🔥", pwr: "sensor.boiler_w" } };

const potenze = (page) =>
  page.evaluate(() =>
    (JSON.parse(localStorage.getItem("cd_loads") || "[]") || []).map((load) => [
      load.id,
      load.power_entity || "",
    ]),
  );

async function avvia(page, testInfo, loads) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) =>
    route.fulfill({ status: 200, body: "" }).catch(() => {}),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(loads));
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((specchio) => {
    localStorage.setItem("cd_flow_nodes", JSON.stringify(specchio));
  }, SPECCHIO);
}

test("il carico che porta il sensore dell'altra casa lo perde, l'originale no", async ({
  page,
}, testInfo) => {
  /* La pompa di sopra ha il contatore SUO e la potenza del boiler di sotto:
   * sta raccontando due macchine diverse, e la potenza non è la sua. */
  await avvia(page, testInfo, [
    {
      id: "boiler",
      name: "Boiler",
      power_entity: "sensor.boiler_w",
      total_energy_entity: "sensor.boiler_kwh",
      order: 0,
    },
    {
      id: "pompa",
      name: "Boiler casa sotto",
      power_entity: "sensor.boiler_w",
      total_energy_entity: "sensor.pompa_kwh",
      order: 0,
      plant: "impianto-2",
    },
  ]);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:persistence-restored", { detail: {} }));
  });
  await expect
    .poll(() => potenze(page), { timeout: 20_000 })
    .toEqual([
      ["boiler", "sensor.boiler_w"],
      ["pompa", ""],
    ]);

  /* E una volta sola: il segno resta, e un secondo giro non tocca più niente. */
  const segno = await page.evaluate(() => localStorage.getItem("cd_carichi_travasati_puliti"));
  expect(segno).toBe("1");
});

test("dove non si può dimostrare, non si cancella: lo dice e basta", async ({ page }, testInfo) => {
  /* Due carichi con la sola potenza: identici a guardarli. La plancia non sa
   * in quale appartamento sta il sensore, e la metà buona non si butta. */
  await avvia(page, testInfo, [
    { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 0 },
    {
      id: "pompa",
      name: "Boiler casa sotto",
      power_entity: "sensor.boiler_w",
      order: 0,
      plant: "impianto-2",
    },
  ]);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:persistence-restored", { detail: {} }));
    localStorage.setItem("cd_energy_plant", "impianto-2");
  });
  await page.waitForTimeout(1200);
  await expect
    .poll(() => potenze(page))
    .toEqual([
      ["boiler", "sensor.boiler_w"],
      ["pompa", "sensor.boiler_w"],
    ]);

  /* La maschera lo dice, e porta il gesto. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("energy");
    } catch (_errore) {}
  });
  const linguetta = page
    .locator("#editor-modal .ed-inner-tab")
    .filter({ hasText: /CARICHI E DISPOSITIVI|LOADS & DEVICES/i })
    .first();
  await linguetta.waitFor({ state: "visible", timeout: 20_000 });
  await linguetta.click();
  /* Il segno sta sulla TESTA della scheda, che nasce chiusa: un avviso dentro
   * una scheda chiusa non avvisa nessuno. */
  const segno = page.locator('#editor-modal [data-dm-load="pompa"] .dm-loads-travaso-segno');
  await expect(segno).toBeVisible({ timeout: 20_000 });
  await expect(segno).toHaveAttribute("title", /Casa sotto/);

  /* Aperta la scheda, la frase e il tasto sono lì. */
  await page.locator('#editor-modal [data-dm-load="pompa"] > summary').click();
  const avviso = page.locator('#editor-modal [data-dm-load="pompa"] .dm-loads-travaso');
  await expect(avviso).toBeVisible({ timeout: 10_000 });
  await expect(avviso).toContainText(/Casa sotto/);

  /* Un click, e da questa casa il sensore se ne va. */
  await avviso.locator("[data-dm-load-travaso]").click();
  await expect(page.locator("#dm-loads-pompa-power")).toHaveValue("");
});

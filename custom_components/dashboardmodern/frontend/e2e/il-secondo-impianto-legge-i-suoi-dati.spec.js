/* Il secondo impianto, fatto a mano, legge i suoi dati.
 *
 * «Ho configurato due impianti ma non legge i dati il secondo impianto.» La
 * prova rifa' il giro dell'utente per intero, non a configurazione gia'
 * pronta: dalla scheda Energia si preme «+ Aggiungi impianto», si scrivono i
 * sensori del secondo impianto nelle caselle, e poi sulla pagina Energia la
 * linguetta del secondo deve mostrare I SUOI numeri — e tornando alla prima,
 * i suoi.
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
    energy: {
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const LETTURE = {
  "sensor.rete_w": "2100",
  "sensor.fv_w": "3400",
  "sensor.casa_w": "2470",
  "sensor.rete2_w": "780",
  "sensor.fv2_w": "1520",
  "sensor.casa2_w": "2300",
};

const misuratori = (page) =>
  page.evaluate(() => {
    const numero = (id) => {
      const nodo = document.getElementById(id);
      return nodo ? (nodo.textContent || "").replace(/[^0-9]/g, "") : "";
    };
    return { rete: numero("v-grid"), solare: numero("v-solar"), casa: numero("v-home") };
  });

test("aggiunto dalla scheda, il secondo impianto mostra i suoi numeri", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page.waitForTimeout(1200);

  /* Dalla scheda: si aggiunge l'impianto col suo bottone. */
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("energy");
  });
  await page.waitForTimeout(700);
  await expect(page.locator("#dm-impianti-cfg [data-dm-impianto-nuovo]")).toBeVisible();
  await page.locator("#dm-impianti-cfg [data-dm-impianto-nuovo]").click();
  await page.waitForTimeout(900);

  /* La scheda adesso mostra le caselle del secondo impianto, vuote. */
  await expect(
    page.locator('#dm-impianti-cfg .dm-imp-tab.active:not([data-dm-impianto="impianto"])'),
  ).toBeVisible();
  await page.evaluate(() => {
    document.querySelectorAll("#ed-body details.ed-acc").forEach((d) => d.setAttribute("open", ""));
  });
  await expect(page.locator("#dm-energy-grid-power").first()).toHaveValue("");

  /* Si scrivono i sensori del secondo impianto. */
  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const input = document.getElementById(id);
      if (!input) throw new Error(`campo mancante: ${id}`);
      input.value = valore;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    scrivi("dm-energy-grid-power", "sensor.rete2_w");
    scrivi("dm-energy-solar-power", "sensor.fv2_w");
    scrivi("dm-energy-house-power", "sensor.casa2_w");
  });
  await page.waitForTimeout(900);

  /* Il salvataggio e' finito nell'impianto nuovo, non sopra il primo. */
  const energia = await page.evaluate(() =>
    window.DashboardModernModules?.store?.getSection?.("energy"),
  );
  expect(energia.grid.power).toBe("sensor.rete_w");
  expect(energia.plants?.[0]?.grid?.power).toBe("sensor.rete2_w");
  expect(energia.plants?.[0]?.solar?.power).toBe("sensor.fv2_w");
  expect(energia.plants?.[0]?.house?.power).toBe("sensor.casa2_w");

  /* Sulla pagina: la linguetta del secondo e' attiva e i numeri sono i suoi. */
  await page.evaluate(() => document.querySelector("#editor-modal .ed-head-close")?.click());
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((tab) => tab.click());
  await page.evaluate(() => window.render?.());
  await expect(page.locator("#dm-impianti-tabs")).toBeVisible();
  await expect
    .poll(() => misuratori(page), { timeout: 20_000 })
    .toEqual({ rete: "780", solare: "1520", casa: "2300" });

  /* E tornando alla prima casa si ritrovano i suoi. */
  await page
    .locator('#page-energy [data-dm-impianto="impianto"]')
    .evaluate((pillola) => pillola.click());
  await page.evaluate(() => window.render?.());
  await expect
    .poll(() => misuratori(page), { timeout: 20_000 })
    .toEqual({ rete: "2100", solare: "3400", casa: "2470" });
});

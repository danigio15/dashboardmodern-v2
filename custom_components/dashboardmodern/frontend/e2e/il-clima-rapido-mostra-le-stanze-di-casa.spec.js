/* Il «Clima rapido» mostra le stanze di CASA, non quelle di casa d'altri.
 *
 * Nel runtime storico c'e' un elenco scritto a mano — Matrimoniale, Cameretta,
 * Cucina, Salone, Bagno, Studio — con dentro le caselle fisse di quella casa.
 * Non e' configurabile da nessuna parte: chi ha altre stanze apriva quel popup
 * e trovava sei tasti coi nomi di casa d'altri, legati a caselle che magari non
 * ha mai riempito.
 *
 * Le unita' del clima le sa la configurazione, ed e' la stessa che disegna la
 * pagina Clima e la scheda.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-mansarda", name: "Mansarda", icon: "🏠", metadata: {} },
      { id: "room-taverna", name: "Taverna", icon: "🏠", metadata: {} },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Luce", entity: "light.salone" }],
    climate: [
      {
        id: "c1",
        name: "Split Mansarda",
        entity: "climate.mansarda",
        room_id: "room-mansarda",
        type: "clima",
      },
      {
        id: "c2",
        name: "Termo Taverna",
        entity: "climate.taverna",
        room_id: "room-taverna",
        type: "termo",
      },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

test("la griglia porta le unita' configurate, non le sei scritte nel guscio", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["climate.mansarda"] = {
      entity_id: "climate.mansarda",
      state: "cool",
      attributes: { friendly_name: "Split Mansarda", temperature: 24, current_temperature: 26 },
    };
    stati["climate.taverna"] = {
      entity_id: "climate.taverna",
      state: "off",
      attributes: { friendly_name: "Termo Taverna", current_temperature: 18 },
    };
    stati["light.salone"] = { entity_id: "light.salone", state: "on", attributes: {} };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1400);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.evaluate(() => window.apriQuickClima?.());
  const nomi = () =>
    page
      .locator("#quick-clima-grid .ns-clima-btn-name")
      .evaluateAll((nodi) => nodi.map((n) => n.textContent.trim()));

  await expect.poll(nomi).toEqual(["Split Mansarda"]);
  /* Le sei stanze del guscio non si vedono da nessuna parte. */
  const testo = await page.locator("#quick-clima-grid").innerText();
  for (const estranea of ["Matrimoniale", "Cameretta", "Studio"])
    expect(testo, `«${estranea}» non e' una stanza di questa casa`).not.toContain(estranea);

  /* In modalita' caldo esce il termosifone, non il condizionatore. */
  await page.evaluate(() => window.setQuickClimaMode?.("caldo"));
  await expect.poll(nomi).toEqual(["Termo Taverna"]);

  /* E il tasto comanda l'entita' vera, non una casella di casa d'altri. */
  const entita = await page
    .locator("#quick-clima-grid .ns-clima-btn")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.entity));
  expect(entita).toEqual(["climate.taverna"]);
});

/* I parametri del MiniPC si chiamano col loro nome.
 *
 * «I nomi dei parametri nella configurazione del Minipc non sono corretti»:
 * le card dicevano «— Nessuna stanza — Casa Ingresso… Nel widget» al posto di
 * «CPU (%)». Il nome vero sta nel value di un campo rinominabile, che nel
 * textContent non compare; e nell'etichetta altri moduli appendono la tendina
 * delle stanze e l'interruttore «Nel widget» — leggere il textContent
 * dell'etichetta raccoglieva SOLO la loro spazzatura.
 *
 * La prova ricrea l'ordine sfortunato: prima i moduli appendono i loro
 * comandi, poi l'editor compatto legge le etichette. I nomi devono essere
 * quelli dei parametri, senza traccia delle stanze.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", order: 0 }],
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
    entityOverrides: { "dm.server_cpu": "sensor.cpu" },
  },
  visibility: { server: true },
};

test("le card del MiniPC dicono «CPU (%)», non le opzioni della tendina", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["sensor.cpu"] = {
      entity_id: "sensor.cpu",
      state: "12",
      attributes: { friendly_name: "CPU", unit_of_measurement: "%" },
    };
    window.applyStates?.();
    window.apriConfigEntita?.();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelector('#editor-modal .ed-tab[data-tab="sez6"]')?.click();
  });
  await page.waitForTimeout(900);

  /* L'ordine sfortunato, reso certo: le tendine e gli interruttori sono gia'
   * appesi alle etichette, e si costringe l'editor compatto a rileggerle. */
  await page.waitForSelector("#ed-body [data-server-compact]", { timeout: 15000 });
  const tendine = await page.evaluate(() => {
    for (const details of document.querySelectorAll("#ed-body details.ed-acc"))
      details.hidden = false;
    window.DashboardModernModules?.roomAssign?.ensureRoomChoices?.();
    return document.querySelectorAll("#ed-body .ed-slot-lbl select, #ed-body .ed-slot-lbl button")
      .length;
  });
  await page.evaluate(() => {
    document.querySelector("#ed-body [data-server-compact]")?.remove();
    document.querySelector('#editor-modal .ed-tab[data-tab="sez6"]')?.click();
  });
  await page.waitForSelector("#ed-body [data-server-compact]", { timeout: 15000 });
  await page.waitForTimeout(400);

  const letto = await page.evaluate(() => {
    const opzioni = [
      ...document.querySelectorAll("#ed-body [data-server-compact] [data-slot-select] option"),
    ].map((option) => option.textContent.trim());
    const card = [
      ...document.querySelectorAll("#ed-body [data-server-compact] .dm-server-row strong"),
    ].map((nodo) => nodo.textContent.trim());
    return { opzioni, card };
  });

  const tutti = [...letto.opzioni, ...letto.card].join(" · ");
  expect(tutti).not.toContain("Nessuna stanza");
  expect(tutti).not.toContain("Nel widget");
  expect(tutti).not.toContain("Salone");
  expect(letto.opzioni.join(" ")).toContain("CPU (%)");
  expect(letto.card.join(" ")).toContain("CPU (%)");
  /* La prova ha senso solo se i comandi degli altri moduli c'erano davvero:
   * senza tendine appese non si sta provando niente. */
  expect(tendine).toBeGreaterThan(0);
});

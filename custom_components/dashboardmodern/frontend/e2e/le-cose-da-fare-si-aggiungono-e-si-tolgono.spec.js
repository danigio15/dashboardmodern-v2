/* Nel widget «Da fare» si scrive una voce nuova e se ne toglie una.
 *
 * La lista si poteva solo spuntare: per aggiungere la spesa dimenticata o per
 * togliere una riga finita li' per sbaglio bisognava uscire dalla plancia e
 * aprire Home Assistant. Adesso in fondo a ogni lista c'e' la riga per
 * scrivere, e ogni voce porta il suo cestino — che non e' «fatta», e' «non
 * c'entrava».
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

const VOCI = [
  { uid: "1", summary: "Pane", status: "needs_action", due: "" },
  { uid: "2", summary: "Latte", status: "needs_action", due: "" },
];

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((voci) => {
    localStorage.setItem(
      "cd_todo",
      JSON.stringify([{ id: "l1", name: "Spesa", entity: "todo.spesa" }]),
    );
    eval("_RAW_STATES")["todo.spesa"] = {
      entity_id: "todo.spesa",
      state: "2",
      attributes: { friendly_name: "Spesa" },
    };
    /* Le voci arrivano da una chiamata al ponte: qui si posano a mano, cosi'
     * la prova guarda i comandi e non la rilettura. */
    const modulo = window.__DASHBOARDMODERN_HOME_WIDGETS__;
    if (modulo)
      modulo.lists.set("todo.spesa", { fetchedAt: Date.now(), inflight: null, items: voci });
    /* Ogni servizio chiesto finisce qui, e nessuno parte davvero. */
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push({ dominio, servizio, dati });
      return Promise.resolve(true);
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VOCI);
  await page.waitForTimeout(1600);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page
    .locator('#dm-widgets .dm-tile[data-dm-widget="todo"]')
    .evaluate((nodo) => nodo.click());
  await expect(page.locator("#dm-widget-popup .dm-todo-item").first()).toBeVisible();
}

test("una voce nuova si scrive in fondo alla lista a cui appartiene", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const casella = page.locator('#dm-widget-popup [data-dm-todo-new="l1"]');
  await expect(casella).toBeVisible();
  await casella.fill("Detersivo");
  await page.locator('#dm-widget-popup [data-dm-todo-add="l1"]').evaluate((nodo) => nodo.click());
  const chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate).toContainEqual({
    dominio: "todo",
    servizio: "add_item",
    dati: { entity_id: "todo.spesa", item: "Detersivo" },
  });
  // E compare subito, senza aspettare la rilettura.
  await expect(page.locator("#dm-widget-popup .dm-todo-item")).toContainText([
    "Pane",
    "Latte",
    "Detersivo",
  ]);
});

test("l'invio vale quanto il tasto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.locator('#dm-widget-popup [data-dm-todo-new="l1"]').fill("Caffè");
  await page.locator('#dm-widget-popup [data-dm-todo-new="l1"]').press("Enter");
  const chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate).toContainEqual({
    dominio: "todo",
    servizio: "add_item",
    dati: { entity_id: "todo.spesa", item: "Caffè" },
  });
});

test("il cestino toglie la voce, e non la segna fatta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page
    .locator('#dm-widget-popup .dm-todo-del[data-dm-todo-uid="2"]')
    .evaluate((nodo) => nodo.click());
  const chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate).toContainEqual({
    dominio: "todo",
    servizio: "remove_item",
    dati: { entity_id: "todo.spesa", item: "2" },
  });
  expect(chiamate.some((c) => c.servizio === "update_item")).toBe(false);
  await expect(page.locator("#dm-widget-popup .dm-todo-item")).toHaveCount(1);
});

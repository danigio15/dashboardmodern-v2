/* Dentro la finestra di un widget si tocca, non si esce.
 *
 * La finestra portava lo stesso segno delle tessere della griglia,
 * `data-dm-widget`, e in fondo a chi ascolta i tocchi c'e' la riga che dice:
 * se sotto il dito c'e' una tessera, aprila o chiudila. Cosi' ogni tocco che
 * non fosse gia' stato preso da un comando risaliva fino alla finestra e la
 * chiudeva: la casella della lista non si riusciva nemmeno a mettere a fuoco.
 *
 * Le prove che c'erano non lo vedevano perche' toccavano `node.click()` sui
 * comandi, e i comandi tornano indietro prima di arrivare a quella riga. Qui
 * si tocca davvero, e si tocca anche dove non c'e' nessun comando.
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

const VOCI = [{ uid: "1", summary: "Pane", status: "needs_action", due: "" }];

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
      state: "1",
      attributes: { friendly_name: "Spesa" },
    };
    const modulo = window.__DASHBOARDMODERN_HOME_WIDGETS__;
    if (modulo)
      modulo.lists.set("todo.spesa", { fetchedAt: Date.now(), inflight: null, items: voci });
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push({ dominio, servizio, dati });
      return Promise.resolve(true);
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VOCI);
  await page.waitForTimeout(1600);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* La tessera si chiama Agenda, adesso.
   *
   * Impegni e cose da fare sono diventati una cosa sola: la tessera «todo» non
   * esiste piu' e le sue righe stanno nell'Agenda, con le stesse classi —
   * `dm-todo-item`, la casella, il testo, il cestino. Quello che questa prova
   * sorveglia non e' cambiato di una virgola: dentro la finestra di un widget
   * si tocca senza uscirne. E' cambiato solo dietro quale tessera si entra. */
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="agenda"]').click();
  await expect(page.locator("#dm-widget-popup .dm-todo-item").first()).toBeVisible();
}

const aperta = (page) => page.evaluate(() => !document.getElementById("dm-widget-popup")?.hidden);

test("toccando la casella, il tasto e una riga la finestra resta aperta", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  // 1. la casella in cui si scrive: qui non si arrivava nemmeno.
  await page.locator('#dm-widget-popup [data-dm-todo-new="l1"]').click();
  expect(await aperta(page), "la casella della lista chiude la finestra").toBe(true);

  // 2. il tasto piu': aggiunge, e non se ne va.
  await page.locator('#dm-widget-popup [data-dm-todo-new="l1"]').fill("Detersivo");
  await page.locator('#dm-widget-popup [data-dm-todo-add="l1"]').click();
  expect(await aperta(page), "il tasto piu' chiude la finestra").toBe(true);
  expect(await page.evaluate(() => window.__chiamate)).toContainEqual({
    dominio: "todo",
    servizio: "add_item",
    dati: { entity_id: "todo.spesa", item: "Detersivo" },
  });

  // 3. il titolo del blocco: nessun comando sotto il dito, e va bene cosi'.
  await page.locator("#dm-widget-popup .dm-w-block-title").first().click();
  expect(await aperta(page), "un tocco a vuoto chiude la finestra").toBe(true);

  // 4. il velo intorno, invece, chiude: e' il modo per uscire.
  await page.mouse.click(5, 5);
  await expect.poll(() => aperta(page)).toBe(false);
});

/* La presa del frigo si vede, ma il tasto non risponde.
 *
 * «Non e' meglio oscurare il tasto accendi/spegni sulla presa del frigo?» — e
 * la risposta e' si', ma «oscurare» da solo sarebbe la meta' del lavoro. Un
 * tasto disegnato spento che poi funziona lo stesso e' peggio di un tasto
 * normale: chi lo guarda crede di non poterlo premere e chi lo preme scopre di
 * si'. Questa prova preme davvero, e pretende che non parta niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:stove", order: 0 }],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { lights: true },
};

test("una presa bloccata si vede, si legge, e non si comanda", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });

  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const id of ["switch.presa_frigo", "switch.presa_tv"])
      stati[id] = { entity_id: id, state: "on", attributes: { friendly_name: id } };
    window.applyStates?.();
    localStorage.setItem(
      "cd_luci",
      JSON.stringify({ "switch.presa_frigo": "Presa frigo", "switch.presa_tv": "Presa TV" }),
    );
    localStorage.setItem(
      "cd_luci_rooms",
      JSON.stringify({ "switch.presa_frigo": "room-cucina", "switch.presa_tv": "room-cucina" }),
    );
    localStorage.setItem("cd_solo_lettura", JSON.stringify({ "switch.presa_frigo": true }));
    /* I comandi non escono di casa: si contano. */
    window.__comandi = [];
    window.cdCallServiceJson = (dominio, servizio, dati) =>
      window.__comandi.push(`${dominio}.${servizio} ${dati?.entity_id || ""}`);
    document.querySelector('.tab[data-tab="luci"]')?.click();
    window.render?.();
  });
  await page.waitForTimeout(700);

  /* La stessa scheda sta anche nella pagina Stanze: qui si guarda quella della
   * pagina Luci, altrimenti il localizzatore ne trova due. */
  const frigo = page.locator('#page-luci [data-dm-lucip="switch.presa_frigo"]');
  const tv = page.locator('#page-luci [data-dm-lucip="switch.presa_tv"]');
  await expect(frigo).toBeVisible();
  await expect(tv).toBeVisible();

  /* Si vede che non si comanda, e si legge lo stesso quello che sta facendo. */
  await expect(frigo).toHaveAttribute("data-dm-lucip-comandabile", "false");
  await expect(tv).toHaveAttribute("data-dm-lucip-comandabile", "true");
  await expect(frigo.locator('[data-kind="bloccata"]')).toBeVisible();
  await expect(frigo.locator("[data-dm-lucip-state]")).not.toBeEmpty();

  /* E adesso si preme davvero. */
  await frigo.locator("[data-dm-lucip-toggle]").click({ force: true });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__comandi)).toEqual([]);

  /* La presa accanto, che nessuno ha bloccato, risponde: la prova sopra
   * passerebbe anche con una pagina rotta che non comanda piu' niente. */
  await tv.locator("[data-dm-lucip-toggle]").click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__comandi)).toEqual(["switch.turn_off switch.presa_tv"]);

  /* Nemmeno «spegni tutte» la tocca. */
  await page.evaluate(() => {
    window.__comandi = [];
    document.querySelector('#page-luci [data-dm-lucip-all="off"]')?.click();
  });
  await page.waitForTimeout(300);
  const dopo = await page.evaluate(() => window.__comandi);
  expect(dopo.some((riga) => riga.includes("switch.presa_frigo"))).toBe(false);
});

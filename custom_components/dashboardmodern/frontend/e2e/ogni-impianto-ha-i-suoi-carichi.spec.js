import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Due impianti, due gruppi di cerchi.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo»: le linguette in cima all'Energia scelgono di quale casa si sta
 * parlando, e da li' in giu' tutto la segue — il misuratore, il fotovoltaico,
 * la batteria. I carichi restavano fuori dal patto, ed erano gli unici a
 * comparire in tutti e due i flussi: la lavatrice dell'altra casa in mezzo
 * alla propria, e nessun modo di toglierla.
 */
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [
      { id: "forno", name: "Forno", icon: "🔥", power_entity: "sensor.forno_w", order: 0 },
      {
        id: "lavatrice",
        name: "Lavatrice",
        icon: "🌀",
        power_entity: "sensor.lavatrice_w",
        order: 1,
        plant: "impianto-2",
      },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      name: "Casa Giovanni",
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
      plants: [
        {
          id: "impianto-2",
          name: "Casa Donato",
          grid: { power: "sensor.rete2_w" },
          solar: { power: "sensor.fv2_w" },
          house: { power: "sensor.casa2_w" },
        },
      ],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* I nomi dei cerchi disegnati sotto Casa, senza ripetizioni: le viste sono
 * tre — istante, giorno, mese — e ognuna ha la sua tela. Prenderli tutti
 * insieme e chiedere l'insieme dice due cose in una: quali cerchi ci sono, e
 * che le tre viste dicono la stessa cosa. */
const cerchi = (page) =>
  page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll("#page-energy [data-dm-flow-node]")]
          .map((nodo) => (nodo.querySelector(".node-label")?.textContent || "").trim())
          .filter(Boolean),
      ),
    ].sort(),
  );

test("ogni impianto ha i suoi cerchi, e cambiare linguetta li cambia", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const letture = {
      "sensor.forno_w": "800",
      "sensor.lavatrice_w": "1200",
      "sensor.rete_w": "2100",
      "sensor.fv_w": "3400",
      "sensor.casa_w": "2470",
      "sensor.rete2_w": "780",
      "sensor.fv2_w": "1520",
      "sensor.casa2_w": "2300",
    };
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.waitForTimeout(1500);

  /* Casa Giovanni e' il primo impianto: il forno e' suo, e la lavatrice —
   * scritta sull'altra casa — non la vede. */
  await expect.poll(() => cerchi(page)).toEqual(["Forno"]);

  // Si passa a Casa Donato dalla linguetta, come farebbe un dito.
  // Click diretto: la riga delle linguette si ridisegna, e l'attesa di
  // stabilita' non arriverebbe mai.
  await page
    .locator('#page-energy [data-dm-impianto="impianto-2"]')
    .evaluate((pillola) => pillola.click());
  await expect.poll(() => cerchi(page)).toEqual(["Lavatrice"]);

  // E tornando indietro si ritrova il proprio, non la somma dei due.
  await page
    .locator('#page-energy [data-dm-impianto="impianto"]')
    .evaluate((pillola) => pillola.click());
  await expect.poll(() => cerchi(page)).toEqual(["Forno"]);
});

/* La lettura dei tre cerchi grandi, quelli che il runtime storico disegna
   leggendo le caselle proiettate. */
const misuratori = (page) =>
  page.evaluate(() => {
    const numero = (id) => {
      const nodo = document.getElementById(id);
      return nodo ? (nodo.textContent || "").replace(/[^0-9]/g, "") : "";
    };
    return { rete: numero("v-grid"), solare: numero("v-solar"), casa: numero("v-home") };
  });

test("anche i misuratori seguono l'impianto, non solo i carichi", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Il difetto visto a schermo: le linguette cambiavano i cerchi dei carichi
   * sotto Casa e lasciavano Rete, Solare e Casa sui contatori della prima
   * abitazione. Sono due conti diversi — i carichi li filtra la sezione, i
   * misuratori li proietta il magazzino nelle caselle storiche — e solo uno
   * dei due sapeva degli impianti. */
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const letture = {
      "sensor.rete_w": "2100",
      "sensor.fv_w": "3400",
      "sensor.casa_w": "2470",
      "sensor.rete2_w": "780",
      "sensor.fv2_w": "1520",
      "sensor.casa2_w": "2300",
    };
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1500);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.evaluate(() => window.render?.());
  await expect
    .poll(() => misuratori(page), { timeout: 20_000 })
    .toEqual({ rete: "2100", solare: "3400", casa: "2470" });

  await page
    .locator('#page-energy [data-dm-impianto="impianto-2"]')
    .evaluate((pillola) => pillola.click());
  await page.evaluate(() => window.render?.());
  await expect
    .poll(() => misuratori(page), { timeout: 20_000 })
    .toEqual({ rete: "780", solare: "1520", casa: "2300" });
});

test("la batteria non trapela nell'impianto che non ce l'ha", async ({ page }, testInfo) => {
  /* «Impianto 2 non ho configurato entità: recupera entità dell'impianto 1» —
   * e infatti nella bolla della batteria restavano incisi la carica e il SOC
   * dell'altra casa. Il cartello del padrone che i moduli piantano sulla
   * bolla ferma la mano del guscio per sempre: chi lo pianta deve scrivere
   * SEMPRE, anche «—». E il SOC si legge dall'impianto scelto, non dal primo
   * livello del documento. */
  test.setTimeout(120_000);
  const conBatteria = JSON.parse(JSON.stringify(SEME));
  conBatteria.sections.energy.battery = {
    power: "sensor.batt_w",
    soc: "sensor.batt_soc",
  };
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, conBatteria);
  await page.evaluate(() => {
    const letture = {
      "sensor.rete_w": "2100",
      "sensor.fv_w": "3400",
      "sensor.casa_w": "2470",
      "sensor.batt_w": "243",
      "sensor.batt_soc": "76",
      "sensor.rete2_w": "780",
      "sensor.fv2_w": "1520",
      "sensor.casa2_w": "2300",
    };
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.evaluate(() => window.render?.());

  const bolle = () =>
    page.evaluate(() => {
      const testo = (id) => (document.getElementById(id)?.textContent || "").trim();
      const visibili = ["n-solar", "n-grid", "n-home", "n-battery"].filter((id) => {
        const nodo = document.getElementById(id);
        if (!nodo) return false;
        const stile = getComputedStyle(nodo);
        return stile.display !== "none" && stile.visibility !== "hidden";
      });
      return { batteria: testo("v-battery"), soc: testo("v-battery-soc"), visibili };
    });

  await expect.poll(async () => (await bolle()).batteria, { timeout: 20_000 }).toContain("243");
  await expect.poll(async () => (await bolle()).soc).toContain("76");

  /* Nell'impianto senza batteria la bolla dice «—», e il SOC non parla. */
  await page
    .locator('#page-energy [data-dm-impianto="impianto-2"]')
    .evaluate((pillola) => pillola.click());
  await page.evaluate(() => window.render?.());
  await expect.poll(async () => (await bolle()).batteria, { timeout: 20_000 }).toBe("—");
  await expect.poll(async () => (await bolle()).soc).not.toContain("76");

  /* E tornando indietro: i suoi numeri, e TUTTI i cerchi al loro posto —
   * «improvvisamente scompare tutto» e' il contrario di questo. */
  await page
    .locator('#page-energy [data-dm-impianto="impianto"]')
    .evaluate((pillola) => pillola.click());
  await page.evaluate(() => window.render?.());
  await expect.poll(async () => (await bolle()).batteria, { timeout: 20_000 }).toContain("243");
  await expect.poll(async () => (await bolle()).soc).toContain("76");
  /* Anche i cerchi si aspettano. Le due righe qui sopra aspettano i numeri,
   * questa leggeva una volta sola: la bolla della batteria rientra in scena
   * un attimo dopo i suoi watt, e sotto carico quell'attimo si allunga —
   * «n-battery» mancava all'appello per un pelo. */
  await expect
    .poll(async () => (await bolle()).visibili, { timeout: 20_000 })
    .toEqual(["n-solar", "n-grid", "n-home", "n-battery"]);
});

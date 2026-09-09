/* I blocchi della Home si spostano dalle frecce, e la Home li segue.
 *
 * «Manca il riordino della Home» — e le tre manopole c'erano gia', ma sempre
 * DENTRO un blocco: le persone si riordinano fra loro, le tessere fra loro, le
 * azioni fra loro. L'ordine dei blocchi era scritto nel codice, e chi rientra
 * in casa e vuole i tasti per primi non poteva averli.
 *
 * Qui si fa il gesto vero: si apre la scheda Home dell'editor — «ti avevo
 * detto nella sezione Home» — si porta «Azioni rapide» in cima con la
 * freccia, e si guarda la Home.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
/* L'elenco dei blocchi si legge dal modello, non si riscrive qui. Scritto a
 * mano, questa prova cadeva il giorno in cui alla Home se ne aggiungeva uno —
 * per il motivo sbagliato: perche' il numero era invecchiato, non perche' il
 * riordino avesse smesso di funzionare. */
import { BLOCCHI_DELLA_HOME } from "../src/core/ordine-dei-blocchi.js";

/* Quello che ci si aspetta dopo aver portato «Azioni rapide» in cima: lui
 * primo, gli altri nell'ordine di serie. */
const AZIONI_IN_CIMA = ["azioni", ...BLOCCHI_DELLA_HOME.filter((nome) => nome !== "azioni")];
const QUANTE_FRECCE = BLOCCHI_DELLA_HOME.indexOf("azioni");

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
    people: [
      { id: "p1", name: "Giovanni", entity: "person.giovanni" },
      { id: "p2", name: "Anna", entity: "person.anna" },
    ],
  },
  visibility: { home: true },
};

const STATI = [
  {
    entity_id: "person.giovanni",
    state: "home",
    attributes: { friendly_name: "Giovanni" },
  },
  { entity_id: "person.anna", state: "not_home", attributes: { friendly_name: "Anna" } },
];

/* L'ordine dei blocchi come si vede in pagina: si guardano i figli della Home
 * e si dice a quale blocco appartiene ognuno. E' quello che vede una persona,
 * non quello che dice la configurazione. */
const ordineInPagina = (page) =>
  page.evaluate(() => {
    const pagina = document.getElementById("page-home");
    const nome = (nodo) => {
      if (nodo.id === "dm-people") return "persone";
      if (nodo.id === "dm-widgets") return "widget";
      if (nodo.id === "dev-grid" || nodo.id === "dev-title") return "dispositivi";
      if (nodo.id === "qa-grid" || nodo.querySelector?.("#qa-grid")) return "azioni";
      return "";
    };
    const fila = [];
    for (const figlio of pagina.children) {
      const quale = nome(figlio);
      if (quale && !fila.includes(quale)) fila.push(quale);
    }
    return fila;
  });

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = haStates;
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        else if (messaggio.type === "call_service") risultato = {};
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    haStates.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
    /* Le persone vivono nella loro chiave, non nel documento canonico: senza,
     * il blocco Persone non nasce e non c'e' niente da riordinare. */
    localStorage.setItem(
      "cd_people",
      JSON.stringify([
        { id: "p1", name: "Giovanni", entity: "person.giovanni" },
        { id: "p2", name: "Anna", entity: "person.anna" },
      ]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATI);
}

test("le azioni rapide si portano in cima alla Home, e ci restano", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  /* Come sta di serie: le persone prima delle azioni. */
  await expect.poll(() => ordineInPagina(page), { timeout: 15_000 }).toContain("persone");
  const prima = await ordineInPagina(page);
  expect(prima.indexOf("persone")).toBeLessThan(prima.indexOf("azioni"));

  /* Il gesto: la scheda Home dell'editor, e la freccia su «Azioni rapide». */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const riga = page.locator('#ed-body [data-dm-home-blocchi] [data-blocco="azioni"]');
  await expect(riga).toBeVisible({ timeout: 15_000 });
  /* E nella scheda dei Widget non c'e' piu': spostare vuol dire togliere di la'. */
  await page.locator('.ed-tab[data-tab="todo"]').first().click();
  await expect(page.locator('#ed-body [data-blocco="azioni"]')).toHaveCount(0);
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  await expect(riga).toBeVisible({ timeout: 15_000 });
  /* Una freccia per ogni posto che lo separa dalla cima: quanti siano lo dice
   * il modello, non un numero battuto qui. */
  for (let passo = 0; passo < QUANTE_FRECCE; passo += 1) {
    await page.locator('#ed-body [data-blocco="azioni"] [data-blocco-su]').click();
  }

  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_home_blocchi") || "null")))
    .toEqual(AZIONI_IN_CIMA);

  /* E la Home lo mostra. */
  await page.evaluate(() => document.getElementById("editor-modal")?.classList.remove("show"));
  await expect
    .poll(() => ordineInPagina(page), { timeout: 15_000 })
    .toEqual(expect.arrayContaining(["azioni", "persone"]));
  const dopo = await ordineInPagina(page);
  expect(dopo.indexOf("azioni")).toBeLessThan(dopo.indexOf("persone"));

  /* E dopo un ricaricamento e' ancora cosi': l'ordine e' della casa, non del
   * giro di disegno che l'ha applicato. */
  await page.reload();
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await expect
    .poll(
      async () => {
        const fila = await ordineInPagina(page);
        return fila.indexOf("azioni") >= 0 && fila.indexOf("azioni") < fila.indexOf("persone");
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  /* E riordinando da un'ALTRA pagina, tornando sulla Home la si trova gia'
   * in ordine: l'ordine si applica a pagina aperta, e il guscio cambia pagina
   * senza avvisare nessuno — senza un orecchio sul cambio di scheda, la Home
   * restava com'era finche' non passava di li' un evento per tutt'altro. */
  await page.evaluate(
    (ordine) => {
      document.querySelector('.tab[data-tab="temp"]')?.click();
      localStorage.setItem("cd_home_blocchi", JSON.stringify(ordine));
    },
    [...BLOCCHI_DELLA_HOME],
  );
  await page.evaluate(() => document.querySelector('.tab[data-tab="home"]')?.click());
  await expect
    .poll(
      async () => {
        const fila = await ordineInPagina(page);
        return fila.indexOf("persone") >= 0 && fila.indexOf("persone") < fila.indexOf("azioni");
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

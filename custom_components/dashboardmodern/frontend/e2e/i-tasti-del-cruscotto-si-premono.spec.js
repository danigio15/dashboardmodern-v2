import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Tab nel cruscotto tiket non funziona, non mi fa selezionare difetti etc e
 * nemmeno in lavorazione.»
 *
 * I tasti c'erano, il tocco arrivava, lo stato cambiava — e non si vedeva
 * niente. `disegna()` cominciava cercando la finestra delle segnalazioni e,
 * non trovandola, tornava indietro prima di arrivare alla riga che ridisegna
 * il cruscotto. Ma il cruscotto e' una pagina della barra: chi ci arriva da li'
 * la finestra non l'ha mai aperta, e nel documento non c'e'.
 *
 * Questa prova sta nel browser e non fra quelle senza schermo apposta: la cosa
 * che si e' rotta e' un giro completo — tocco, stato, markup nuovo, tasto
 * acceso — e a spezzarlo in pezzi provabili a tavolino ognuno dei pezzi
 * risultava sano, che e' esattamente quello che e' successo.
 *
 * E le fotografie della galleria non se ne sono accorte perche' seminavano il
 * filtro gia' scelto prima di far disegnare la pagina: il filtro nella foto era
 * acceso senza che nessuno l'avesse mai premuto.
 */

const seed = {
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

const CODA = [
  {
    number: 197,
    type: "bug",
    title: "La foto dell'auto torna quella di prima",
    body: "Seleziono la vettura nuova, salvo, e ricompare quella vecchia.",
    state: "inviato",
    issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/197",
    author: "marco-b",
    origin: "plancia",
    created_at: "2026-08-30T09:12:00Z",
  },
  {
    number: 196,
    type: "assistenza",
    title: "Non trovo la pagina Piscina",
    body: "Ho configurato le entita' ma la sezione non compare nella barra.",
    state: "inviato",
    issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/196",
    author: "chiara-r",
    origin: "plancia",
    created_at: "2026-08-29T18:40:00Z",
  },
  {
    number: 194,
    type: "bug",
    title: "Le tapparelle non si fermano a meta'",
    body: "Premo stop e continuano a scendere fino in fondo.",
    state: "in-carico",
    issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/194",
    author: "luca-p",
    origin: "plancia",
    assignees: ["danigio15"],
    created_at: "2026-08-27T11:05:00Z",
  },
  {
    number: 190,
    type: "bug",
    title: "Il meteo restava indietro di un'ora",
    body: "Risolta nella beta precedente.",
    state: "risolto",
    issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/190",
    author: "marco-b",
    origin: "plancia",
    created_at: "2026-08-20T07:30:00Z",
  },
];

const voci = (page) => page.locator("#page-cruscotto .dm-tkt-voce");
const titoli = (page) => page.locator("#page-cruscotto .dm-tkt-voce-tit");

async function apriIlCruscotto(page, coda) {
  await page.evaluate((elenco) => {
    const stato = window.__DASHBOARDMODERN_SEGNALAZIONI__;
    stato.console = true;
    stato.queue = elenco;
    /* Appena letta: il tocco sulla voce chiede la coda solo se quella che ha
       e' vecchia, e qui non deve andare a cercare un Home Assistant che in
       questa prova non c'e'. */
    stato.queueAt = Date.now();
    window.DashboardModernSegnalazioni.sistema();
    /* Il cambio pagina si fa da qui e non con un tocco vero: sul tablet la
       barra parte ferma, e quale sia il modo di arrivare al cruscotto non e'
       la cosa che questa prova vuole provare. */
    document.querySelector('.tab[data-tab="cruscotto"]').click();
  }, coda);
  await expect(page.locator("#page-cruscotto")).toHaveClass(/active/);
}

test.describe("i filtri del cruscotto rispondono al tocco", () => {
  test("stato e tipo si premono anche senza aver mai aperto la finestra", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await apriIlCruscotto(page, CODA);

    /* La condizione in cui il difetto viveva, scritta come tale: la finestra
     * delle segnalazioni non esiste nel documento, e non deve esistere. Se un
     * giorno qualcosa la costruisse all'avvio, questa prova passerebbe per il
     * motivo sbagliato e non se ne accorgerebbe nessuno. */
    await expect(page.locator("#dm-tkt-modal")).toHaveCount(0);

    // Si parte da «Da lavorare»: le tre aperte, la chiusa no.
    await expect(voci(page)).toHaveCount(3);
    await expect(page.locator('#page-cruscotto [data-dm-filtro="aperte"]')).toHaveClass(/attivo/);

    // «In lavorazione»: resta quella presa in carico.
    await page.locator('#page-cruscotto [data-dm-filtro="in-carico"]').click();
    await expect(page.locator('#page-cruscotto [data-dm-filtro="in-carico"]')).toHaveClass(
      /attivo/,
    );
    await expect(page.locator('#page-cruscotto [data-dm-filtro="aperte"]')).not.toHaveClass(
      /attivo/,
    );
    await expect(titoli(page)).toHaveText(["Le tapparelle non si fermano a meta'"]);

    // «Nuove»: le due che nessuno ha ancora preso.
    await page.locator('#page-cruscotto [data-dm-filtro="nuove"]').click();
    await expect(page.locator('#page-cruscotto [data-dm-filtro="nuove"]')).toHaveClass(/attivo/);
    await expect(voci(page)).toHaveCount(2);

    // «Difetti» e' l'altro asse: si incrocia con lo stato, non lo scaccia.
    await page.locator('#page-cruscotto [data-dm-tipo-coda="bug"]').click();
    await expect(page.locator('#page-cruscotto [data-dm-tipo-coda="bug"]')).toHaveClass(/attivo/);
    await expect(page.locator('#page-cruscotto [data-dm-filtro="nuove"]')).toHaveClass(/attivo/);
    await expect(titoli(page)).toHaveText(["La foto dell'auto torna quella di prima"]);

    // E il tipo resta scelto passando a «Chiuse».
    await page.locator('#page-cruscotto [data-dm-filtro="chiuse"]').click();
    await expect(titoli(page)).toHaveText(["Il meteo restava indietro di un'ora"]);

    // «Ogni tipo» non vuol dire «senza tipo»: torna tutto quello dello stato.
    await page.locator('#page-cruscotto [data-dm-filtro="tutte"]').click();
    await page.locator('#page-cruscotto [data-dm-tipo-coda=""]').click();
    await expect(voci(page)).toHaveCount(4);
  });

  test("il conto sotto i tasti del tipo si rifa' dentro lo stato scelto", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await apriIlCruscotto(page, CODA);

    /* Il numero sotto «Difetti» dice quanti difetti ci sono DENTRO lo stato
     * acceso. Se il tocco non ridisegna, quel numero resta quello di prima: e'
     * il secondo modo, piu' silenzioso, in cui il difetto si vedeva. */
    const difetti = page.locator('#page-cruscotto [data-dm-tipo-coda="bug"] .dm-tkt-quanti');
    await expect(difetti).toHaveText("2");

    await page.locator('#page-cruscotto [data-dm-filtro="in-carico"]').click();
    await expect(difetti).toHaveText("1");

    await page.locator('#page-cruscotto [data-dm-filtro="chiuse"]').click();
    await expect(difetti).toHaveText("1");
  });
});

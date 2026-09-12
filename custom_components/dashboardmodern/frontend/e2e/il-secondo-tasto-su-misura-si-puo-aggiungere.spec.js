/* «Non fa inserire altri tasti oltre al primo» (#431).
 *
 * Aggiungere un tasto d'inserimento su misura salva; salvare rifà la scheda; e
 * il blocco se ne andava con lei — il secondo «＋» non c'era più da premere.
 * Qui si premono tre volte, sulla scheda vera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CENTRALE = "alarm_control_panel.casa";

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
    entityOverrides: { "dm.security_centrale_allarme": CENTRALE },
  },
  visibility: { home: true, security: true },
};

/* Il rito d'apertura, uguale per tutte le prove qui dentro. */
async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((id) => {
    const stati = {
      [id]: {
        entity_id: id,
        state: "disarmed",
        attributes: { friendly_name: "Casa", supported_features: 63 },
      },
      "script.inserisci_totale": {
        entity_id: "script.inserisci_totale",
        state: "off",
        attributes: { friendly_name: "Inserisci totale" },
      },
      "script.inserisci_notte": {
        entity_id: "script.inserisci_notte",
        state: "off",
        attributes: { friendly_name: "Inserisci notte" },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CENTRALE);

  await page.evaluate(() => window.apriConfigEntita());
  /* La linguetta si PREME, non si chiama: il blocco si riaggancia al corpo
   * della scheda quando la scheda cambia, e il corpo cambia sotto le dita di
   * chi tocca. Chiamando `editorSwitch` a mano si prova una plancia che
   * nessuno usa. */
  await page.locator('.ed-tab[data-tab="sez4"]').first().click();
}

test("il «＋» si può premere più di una volta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);

  /* Il blocco compare da sé: si aggancia alla casella della centrale. */
  const piu = page.locator("#dm-antifurto-su-misura [data-suo-add]");
  await expect(piu).toHaveCount(1, { timeout: 20_000 });

  const righe = page.locator("#dm-antifurto-su-misura [data-suo-index]");
  for (const quante of [1, 2, 3]) {
    await piu.first().click();
    /* Dopo ogni «＋» il blocco deve essere ancora lì, col tasto in più: prima
     * sparivano entrambi, e il secondo non si poteva nemmeno tentare. */
    await expect(righe).toHaveCount(quante, { timeout: 10_000 });
    await expect(page.locator("#dm-antifurto-su-misura [data-suo-add]")).toHaveCount(1);
  }

  /* E i tre restano scritti, non solo disegnati. */
  const salvati = await page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("cd_antifurto_su_misura") || "[]").length;
    } catch (_errore) {
      return -1;
    }
  });
  expect(salvati).toBe(3);
});

/* «Continua a far creare solo il primo tasto, il secondo non viene salvato e
 * continuamente resettato» (#494, dopo #431).
 *
 * La prova qui sopra preme «＋» e guarda che le righe compaiano: e' quello che
 * chiedeva #431, e passava. Ma nessuno aveva mai provato il gesto per cui i
 * tasti esistono — scriverci dentro e salvare — e li' il difetto c'era eccome:
 * la casella non stava ferma abbastanza da poterla compilare.
 *
 * Non si ridisegnava niente: erano gli ATTRIBUTI. Chi fa la guardia ai campi
 * dell'entita' ripassava su ogni campo riscrivendo `data-entity-input`,
 * `data-entity-target` e `aria-label` col valore che avevano gia'. Il documento
 * non confronta: registra la scrittura e sveglia chi guarda; chi si sveglia
 * richiama la guardia. Da fermi, col dito lontano, trentotto modifiche in tre
 * secondi — e un campo che trema dodici volte al secondo non si lascia
 * scrivere.
 *
 * Qui si pretende il gesto intero, due volte di fila. */
test("due tasti si compilano e si salvano, e restano tutti e due", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);

  const piu = page.locator("#dm-antifurto-su-misura [data-suo-add]");
  await expect(piu).toHaveCount(1, { timeout: 20_000 });

  const compila = async (indice, nome, entita) => {
    await piu.first().click();
    const riga = page.locator(`#dm-antifurto-su-misura [data-suo-index="${indice}"]`);
    await expect(riga).toHaveCount(1, { timeout: 10_000 });
    await riga.locator('[data-suo-field="nome"]').fill(nome);
    /* Il campo dell'entita' e' un campo entita' come tutti gli altri della
     * configurazione: al posto della casella con l'id c'e' la pastiglia, che
     * apre la ricerca di casa, e l'id da scrivere a mano sta dietro la matita.
     * Qui si scrive a mano, che e' la strada di chi il nome del suo script lo
     * sa gia' — ed e' lo stesso gesto che fanno le prove delle altre schede. */
    const campo = riga.locator('[data-suo-field="entita"]');
    if (!(await campo.isVisible())) await riga.locator(".dm-chip-manual").first().click();
    await campo.fill(entita);
    /* E si salva dal tasto in fondo alla scheda: da quando la configurazione e'
     * uniforme (#404) i «salva» dentro i pannelli stanno nascosti, e quello in
     * fondo li preme tutti. E' il gesto che fa chi usa la plancia — premere il
     * tasto della riga non lo puo' fare nessuno, perche' non si vede. */
    await page.locator("#ed-body [data-dm-save-all]").click();
  };

  await compila(0, "Totale", "script.inserisci_totale");
  await compila(1, "Notte", "script.inserisci_notte");

  const salvati = await page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("cd_antifurto_su_misura") || "[]");
    } catch (_errore) {
      return [];
    }
  });
  expect(salvati.map((voce) => voce.nome)).toEqual(["Totale", "Notte"]);
  expect(salvati.map((voce) => voce.entita)).toEqual([
    "script.inserisci_totale",
    "script.inserisci_notte",
  ]);
});

/* E la ragione per cui si poteva scrivere: da fermi non si scrive niente.
 *
 * Questa prova non guarda un tasto: guarda il documento. Una scheda aperta e
 * lasciata stare non deve produrre modifiche, perche' ogni modifica a vuoto
 * sveglia qualcuno che ne fa altre. E' anche la ragione per cui il mini PC si
 * scaldava (#223): lo stesso difetto, in un altro punto.
 */
test("da fermi la scheda non scrive niente", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await page.locator("#dm-antifurto-su-misura [data-suo-add]").click();
  await expect(page.locator('#dm-antifurto-su-misura [data-suo-index="0"]')).toHaveCount(1);

  const quante = await page.evaluate(async () => {
    const blocco = document.getElementById("dm-antifurto-su-misura");
    let mutazioni = 0;
    const spia = new MutationObserver((voci) => {
      mutazioni += voci.length;
    });
    spia.observe(blocco, { childList: true, subtree: true, attributes: true });
    await new Promise((esci) => setTimeout(esci, 2000));
    spia.disconnect();
    return mutazioni;
  });
  expect(quante, "la scheda ferma continua a riscriversi addosso").toBe(0);
});

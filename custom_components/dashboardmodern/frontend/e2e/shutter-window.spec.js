/* La tapparella sta fuori, l'infisso si vede da dentro.
 *
 * La card mostrava una tapparella senza finestra. Si guarda invece dalla stanza,
 * e allora in primo piano c'e' sempre l'infisso — telaio, due ante, maniglia —
 * con la tapparella che scende dietro. E un infisso puo' essere aperto: un
 * contatto sull'anta lo dice, e le ante rientrano verso i loro cardini.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [
      { id: "c1", name: "Camera", entity: "cover.c1", contact: "binary_sensor.finestra_camera" },
      { id: "c2", name: "Salone", entity: "cover.c2" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const STATES = [
  {
    entity_id: "cover.c1",
    state: "open",
    attributes: { friendly_name: "Camera", current_position: 100, supported_features: 15 },
  },
  {
    entity_id: "cover.c2",
    state: "closed",
    attributes: { friendly_name: "Salone", current_position: 0, supported_features: 15 },
  },
  {
    entity_id: "binary_sensor.finestra_camera",
    state: "on",
    attributes: { friendly_name: "Finestra camera", device_class: "window" },
  },
];

async function apriTapparelle(page, testInfo) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-shutter-window-style")),
    null,
    { timeout: 15000 },
  );
  await page.evaluate((states) => {
    const raw = eval("_RAW_STATES");
    for (const entry of states) raw[entry.entity_id] = entry;
  }, STATES);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-tapparelle").classList.add("active");
    globalThis.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#page-tapparelle .tapp-card[data-tapp] .dm-tw-infisso").length >=
      2,
    null,
    { timeout: 20_000 },
  );
}

function carte(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#page-tapparelle .tapp-card[data-tapp]")].map((card) => {
      const vano = card.querySelector(".tapp-win");
      const anta = vano?.querySelector(".dm-tw-anta-sx");
      return {
        tapp: card.getAttribute("data-tapp"),
        infisso: Boolean(vano?.querySelector(".dm-tw-infisso .dm-tw-telaio")),
        ante: vano?.querySelectorAll(".dm-tw-anta").length || 0,
        maniglia: Boolean(vano?.querySelector(".dm-tw-maniglia")),
        stato: vano?.dataset.dmInfissoStato || "",
        // L'anta aperta si stringe verso il suo cardine.
        stretta: anta ? getComputedStyle(anta).transform !== "none" : false,
        pastiglia: card.querySelector(".dm-tw-pill")?.textContent?.trim() || "",
      };
    }),
  );
}

test("l'infisso sta in primo piano su ogni tapparella", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  const lista = await carte(page);
  expect(lista.length).toBe(2);
  for (const carta of lista) {
    expect(carta.infisso, `${carta.tapp} ha il telaio`).toBe(true);
    expect(carta.ante, `${carta.tapp} ha due ante`).toBe(2);
    expect(carta.maniglia, `${carta.tapp} ha la maniglia`).toBe(true);
  }

  // E l'infisso sta davanti alla tapparella, non dietro: e' la tapparella a
  // stare fuori.
  const ordine = await page.evaluate(() => {
    const vano = document.querySelector("#page-tapparelle .tapp-win");
    const z = (selector) => Number(getComputedStyle(vano.querySelector(selector)).zIndex) || 0;
    return { infisso: z(".dm-tw-infisso"), tapparella: z(".tapp-shutter") };
  });
  expect(ordine.infisso).toBeGreaterThan(ordine.tapparella);
});

test("il contatto apre la finestra, e solo quella che ce l'ha", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);

  let lista = await carte(page);
  const conSensore = lista.find((carta) => carta.tapp === "cover.c1");
  const senzaSensore = lista.find((carta) => carta.tapp === "cover.c2");
  expect(conSensore.stato).toBe("aperto");
  expect(conSensore.stretta, "l'anta rientra verso il cardine").toBe(true);
  expect(conSensore.pastiglia).toBe("Finestra aperta");
  // Chi non ha il contatto resta chiuso e non guadagna una pastiglia.
  expect(senzaSensore.stato).toBe("chiuso");
  expect(senzaSensore.pastiglia).toBe("");

  // Si chiude la finestra: la card la segue.
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["binary_sensor.finestra_camera"] = {
      ...raw["binary_sensor.finestra_camera"],
      state: "off",
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect
    .poll(async () => (await carte(page)).find((carta) => carta.tapp === "cover.c1")?.stato)
    .toBe("chiuso");
  lista = await carte(page);
  expect(lista.find((carta) => carta.tapp === "cover.c1").pastiglia).toBe("");
});

/* Aspetta che una cosa ci sia, invece di sperare che sia arrivata.
 *
 * Le attese a tempo fisso reggono finche' il motore e' quello di casa: su
 * WebKit, che ci mette il doppio, la stessa prova cadeva perche' guardava
 * troppo presto. Non era un difetto della plancia, era una prova che misurava
 * la velocita' della macchina. */
function aspetta(page, condizione, argomento) {
  return page.waitForFunction(condizione, argomento, { timeout: 20_000 });
}

async function apriSchedaTapparelle(page) {
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await aspetta(page, () =>
    Boolean(document.querySelector("#editor-modal .ed-tab[data-tab='tapp']")),
  );
  await page.evaluate(() => {
    document.querySelector('#editor-modal .ed-tab[data-tab="tapp"]')?.click();
  });
  // Prima il campo che stampa il runtime, poi quello aggiunto dal modulo: il
  // secondo arriva su un disegno successivo.
  await aspetta(page, () => Boolean(document.getElementById("ed-tp-ent")));
  await aspetta(page, () => Boolean(document.getElementById("ed-tp-contact")));
}

test("il sensore si configura dove si configura la tapparella", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  await apriSchedaTapparelle(page);

  // Il campo riceve il trattamento di tutti gli altri campi entita': la
  // pastiglia che apre il catalogo, la matita e il cestino. Non si controlla la
  // lente com'e' nata, perche' proprio quella decorazione la trasforma; si
  // controlla che sia arrivata.
  await aspetta(page, () =>
    Boolean(document.getElementById("ed-tp-contact")?.closest('[data-dm-entity-chip="true"]')),
  );
  const pastiglia = await page.evaluate(() =>
    Boolean(
      document
        .getElementById("ed-tp-contact")
        ?.closest(".ed-form-row")
        ?.querySelector(".dm-slot-chip"),
    ),
  );
  expect(pastiglia, "il campo ha la pastiglia che apre il catalogo").toBe(true);

  // Si compila come si compila a mano, e si aggiunge la tapparella.
  await page.evaluate(() => {
    document.getElementById("ed-tp-name").value = "Bagno";
    document.getElementById("ed-tp-ent").value = "cover.c3";
    document.getElementById("ed-tp-contact").value = "binary_sensor.finestra_bagno";
    globalThis.edTappAdd?.();
  });

  /* Si guarda dove il disegno va a leggere: il modello canonico se c'e' gia',
   * altrimenti la copia in localStorage. Il modello si allinea con i suoi
   * tempi, e chiedere solo a lui vorrebbe dire misurare la sincronizzazione
   * invece del salvataggio. */
  const nuova = () =>
    page.evaluate(() => {
      const canoniche = globalThis.DashboardModernModules?.store?.getSection?.("covers") || [];
      const chiave = Object.keys(localStorage).find((name) => name.endsWith("cd_tapparelle"));
      let copia = [];
      try {
        copia = JSON.parse(localStorage.getItem(chiave || "cd_tapparelle") || "[]");
      } catch (_error) {}
      const trova = (elenco) => elenco.find((item) => item?.entity === "cover.c3");
      const voce = trova(canoniche) || trova(copia) || null;
      return { nome: voce?.name || "", contatto: voce?.contact || "" };
    });

  await expect.poll(async () => (await nuova()).nome, { timeout: 20_000 }).toBe("Bagno");
  // E quello che si e' scritto si ritrova dove il disegno lo va a leggere.
  await expect
    .poll(async () => (await nuova()).contatto, { timeout: 20_000 })
    .toBe("binary_sensor.finestra_bagno");
});

/* La matita apre il suo editor, e il contatto dev'essere anche li'.
 *
 * Le matite delle righe sono intercettate in fase di cattura da un altro
 * modulo, che apre la propria finestra di modifica: quella con nome, entita' e
 * stanza. Il campo aggiunto al modulo di aggiunta non passa da li', quindi
 * senza questo un contatto sbagliato non si poteva ne' correggere ne' togliere
 * — si poteva solo cancellare la tapparella e rifarla.
 */
test("il contatto si modifica anche dalla matita", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  await apriSchedaTapparelle(page);

  // La matita della prima tapparella, quella che il contatto ce l'ha gia'.
  await aspetta(page, () => Boolean(document.querySelector("#ed-body .ed-row .dm-edit-existing")));
  await page.evaluate(() => {
    document.querySelector("#ed-body .ed-row .dm-edit-existing")?.click();
  });
  await aspetta(page, () =>
    Boolean(document.querySelector("#dm-shutter-editor-modal form")?.elements?.contact),
  );

  const partenza = await page.evaluate(
    () => document.querySelector("#dm-shutter-editor-modal form").elements.contact.value,
  );
  // Ci arriva gia' compilato con quello che c'era.
  expect(partenza).toBe("binary_sensor.finestra_camera");

  await page.evaluate(() => {
    const form = document.querySelector("#dm-shutter-editor-modal form");
    form.elements.contact.value = "binary_sensor.finestra_nuova";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  // E quello che si scrive si salva.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const canoniche = globalThis.DashboardModernModules?.store?.getSection?.("covers") || [];
          const chiave = Object.keys(localStorage).find((name) => name.endsWith("cd_tapparelle"));
          let copia = [];
          try {
            copia = JSON.parse(localStorage.getItem(chiave || "cd_tapparelle") || "[]");
          } catch (_error) {}
          const trova = (elenco) => elenco.find((item) => item?.entity === "cover.c1");
          return trova(canoniche)?.contact ?? trova(copia)?.contact ?? "";
        }),
      { timeout: 20_000 },
    )
    .toBe("binary_sensor.finestra_nuova");
});

/* Il catalogo delle entita' deve stare davanti alla finestra che lo chiama.
 *
 * La finestra di modifica sta a 100040, il catalogo si apre a 100000 scritto a
 * mano sull'elemento: si apriva davvero, ma dietro. Chi premeva "Scegli
 * entita'" vedeva la stessa schermata di prima e concludeva che il pulsante non
 * funzionasse — e valeva per tutte le finestre di modifica, non solo per il
 * campo nuovo.
 */
test("il catalogo delle entita' si apre davanti, non dietro", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  await apriSchedaTapparelle(page);

  await aspetta(page, () => Boolean(document.querySelector("#ed-body .ed-row .dm-edit-existing")));
  await page.evaluate(() => {
    document.querySelector("#ed-body .ed-row .dm-edit-existing")?.click();
  });
  await aspetta(page, () =>
    Boolean(document.querySelector("#dm-shutter-editor-modal form")?.elements?.contact),
  );

  const esito = await page.evaluate(async () => {
    const form = document.querySelector("#dm-shutter-editor-modal form");
    const riga = form.elements.contact.closest(".ed-form-row");
    const lente = riga.querySelector(".dm-entity-picker") || riga.querySelector("button");
    // Due aperture di fila: e' quello che succede quando due gestori partono
    // sullo stesso tocco, ed e' cosi' che si vedevano due cataloghi uno sopra
    // l'altro, con quello davanti vuoto.
    lente?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    globalThis.wzPickEntity?.(form.elements.contact);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const cataloghi = [...document.querySelectorAll("#cd-entpick")];
    if (!cataloghi.length) return { aperto: false };
    const centro = document.elementFromPoint(
      Math.round(innerWidth / 2),
      Math.round(innerHeight / 2),
    );
    return {
      aperto: true,
      quanti: cataloghi.length,
      // Quello che resta dev'essere pieno: un catalogo vuoto e' quello di
      // troppo, perche' la ricerca riempie sempre la lista di sotto.
      voci: cataloghi[0].querySelectorAll("#cd-ep-list > *").length,
      // Aperto non basta: dev'essere anche quello che si tocca.
      davanti: Boolean(centro?.closest("#cd-entpick")),
    };
  });
  expect(esito.aperto, "il catalogo si apre").toBe(true);
  expect(esito.quanti, "e ce n'e' uno solo").toBe(1);
  expect(esito.voci, "con le entita' dentro").toBeGreaterThan(0);
  expect(esito.davanti, "e sta davanti alla finestra di modifica").toBe(true);
});

/* Con la tapparella giu' la finestra aperta dev'essere comunque leggibile.
 *
 * Le ante rientravano su un fondo dello stesso colore: la card diceva "finestra
 * aperta" e mostrava una tapparella chiusa qualunque. L'anta aperta deve
 * prendere corpo e fare ombra, cosi' si stacca da cio' che ha dietro — che sia
 * la tapparella chiara o il cielo.
 */
test("l'anta aperta si stacca da cio' che ha dietro", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);

  const misura = () =>
    page.evaluate(() => {
      const carta = document.querySelector('#page-tapparelle .tapp-card[data-tapp="cover.c1"]');
      const vano = carta.querySelector(".tapp-win");
      const anta = vano.querySelector(".dm-tw-anta-sx");
      const spalla = vano.querySelector(".dm-tw-spalla");
      const stile = getComputedStyle(anta);
      return {
        stato: vano.dataset.dmInfissoStato,
        // Da aperta l'anta ha un corpo suo, da chiusa lascia vedere il vetro.
        corpo: stile.backgroundImage !== "none",
        ombra: stile.boxShadow.split(",").length >= 2,
        spessore: Number(getComputedStyle(spalla).opacity),
      };
    });

  const aperta = await misura();
  expect(aperta.stato).toBe("aperto");
  expect(aperta.corpo, "l'anta aperta prende corpo").toBe(true);
  expect(aperta.ombra, "e fa ombra su cio' che ha dietro").toBe(true);
  expect(aperta.spessore, "e si vede lo spessore del muro").toBeGreaterThan(0.9);

  // Chiusa torna trasparente: se no si perderebbe il vetro.
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["binary_sensor.finestra_camera"] = {
      ...raw["binary_sensor.finestra_camera"],
      state: "off",
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect.poll(async () => (await misura()).stato, { timeout: 20_000 }).toBe("chiuso");
  // Lo spessore si spegne sfumando: si aspetta che abbia finito, non che sia
  // gia' finito.
  await expect.poll(async () => (await misura()).spessore < 0.1, { timeout: 20_000 }).toBe(true);
  const chiusa = await misura();
  expect(chiusa.corpo, "l'anta chiusa lascia vedere il vetro").toBe(false);
});

/* Il nome della tapparella non cede il posto allo stato.
 *
 * Con due pastiglie accanto — "Aperta" e "Finestra aperta" — a cedere spazio
 * era il nome, che finiva troncato: "Tapparella so…". Il nome e' il dato che
 * identifica la scheda; lo stato e' un commento, e a andare a capo dev'essere
 * lui.
 */
test("il nome resta intero anche con due pastiglie", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  const nomi = await page.evaluate(() =>
    [...document.querySelectorAll("#page-tapparelle .tapp-card[data-tapp]")].map((carta) => {
      const nome = carta.querySelector(".tapp-name");
      const pastiglie = [...carta.querySelectorAll(".tapp-head .tapp-state")];
      const suo = nome.getBoundingClientRect();
      return {
        tapp: carta.getAttribute("data-tapp"),
        pastiglie: pastiglie.length,
        // Troncato vuol dire che il testo e' piu' largo della sua casella.
        troncato: nome.scrollWidth > nome.clientWidth + 1,
        /* E soprattutto: con due pastiglie il nome tiene la sua riga. La
         * troncatura si vede solo a certe larghezze, mentre questo e' il
         * contratto — lo stato va a capo, il nome no — e vale sempre. */
        soloSuaRiga: pastiglie.every(
          (pastiglia) => pastiglia.getBoundingClientRect().top >= suo.bottom - 1,
        ),
      };
    }),
  );
  const conDue = nomi.find((voce) => voce.tapp === "cover.c1");
  expect(conDue.pastiglie, "la prima ha due pastiglie").toBe(2);
  expect(conDue.soloSuaRiga, "e il nome tiene la sua riga").toBe(true);
  for (const voce of nomi) {
    expect(voce.troncato, `${voce.tapp} mostra il nome per intero`).toBe(false);
  }
  // Con una pastiglia sola non si cambia niente: resta sulla riga del nome.
  const conUna = nomi.find((voce) => voce.tapp === "cover.c2");
  expect(conUna.pastiglie).toBe(1);
  expect(conUna.soloSuaRiga, "con una pastiglia la riga resta una").toBe(false);
});

/* Le quattro caselle stanno insieme, dentro il modulo.
 *
 * Ci si ancorava alla stanza, cercandone il contenitore con
 * `closest("label, .ed-slot, div")`. Ma nel markup del runtime la stanza e' un
 * `<select>` nudo — niente `label`, niente `.ed-slot` — e quel `div` finale
 * acchiappava il riquadro che avvolge tutto il pannello: le tre caselle
 * uscivano dopo «Aggiungi tapparella» e dopo «Salva sezione», staccate dalla
 * riga che stanno descrivendo. Segnalato con lo schermo alla mano.
 *
 * La prova guarda l'ordine vero del documento, perche' e' li' che si vedeva. */
test("le tre caselle stanno sotto la tapparella, non in fondo al pannello", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  await apriSchedaTapparelle(page);

  const posti = await page.evaluate(() => {
    const corpo = document.getElementById("ed-body");
    const tutti = [...corpo.querySelectorAll("*")];
    const posto = (id) => {
      const nodo = document.getElementById(id);
      return nodo ? tutti.indexOf(nodo) : -1;
    };
    const salva = tutti.findIndex((nodo) =>
      /salva sezione/i.test(nodo.children.length ? "" : nodo.textContent || ""),
    );
    const aggiungi = tutti.findIndex((nodo) =>
      /aggiungi tapparella/i.test(nodo.children.length ? "" : nodo.textContent || ""),
    );
    return {
      nome: posto("ed-tp-name"),
      ent: posto("ed-tp-ent"),
      tenda: posto("ed-tp-tenda"),
      tendasole: posto("ed-tp-tendasole"),
      contact: posto("ed-tp-contact"),
      room: posto("ed-tp-room"),
      aggiungi,
      salva,
    };
  });

  for (const [nome, valore] of Object.entries(posti)) {
    expect(valore, `${nome} non e' nel pannello`).toBeGreaterThan(-1);
  }

  /* La stanza sta in alto, accanto al nome: «la stanza la devi spostare in
   * alto dove si sceglie il nome e devi indicare che e' la stanza». Stava in
   * coda, nuda, e chi compilava arrivava alla fine per scoprire di doverla
   * scegliere — sempre che capisse che quel menu era la stanza. */
  expect(posti.room, "la stanza subito dopo il nome").toBeGreaterThan(posti.nome);
  expect(posti.room, "la stanza prima delle caselle della meccanica").toBeLessThan(posti.ent);
  // Poi la tapparella e le sue tre compagne, nell'ordine in cui si compilano.
  expect(posti.tenda, "tenda dopo la tapparella").toBeGreaterThan(posti.ent);
  expect(posti.tendasole, "tenda da sole dopo la tenda").toBeGreaterThan(posti.tenda);
  expect(posti.contact, "sensore dopo la tenda da sole").toBeGreaterThan(posti.tendasole);

  // E tutte e tre dentro il modulo: mai dopo i due pulsanti.
  for (const chiave of ["tenda", "tendasole", "contact"]) {
    expect(posti[chiave], `${chiave} prima di «Aggiungi tapparella»`).toBeLessThan(posti.aggiungi);
    expect(posti[chiave], `${chiave} prima di «Salva sezione»`).toBeLessThan(posti.salva);
  }
});

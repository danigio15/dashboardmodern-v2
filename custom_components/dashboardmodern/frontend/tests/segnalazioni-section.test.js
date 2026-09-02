/*
 * La finestra delle segnalazioni: il contratto verso il backend e verso il
 * ponte, e il trattamento del testo che l'utente scrive.
 *
 * Quello che si prova qui non e' il disegno — quello lo prova un browser vero
 * — ma le tre cose che in un browser vero si scoprirebbero tardi e male: un
 * tipo di messaggio non ammesso dal ponte, una chiave di diagnostica che
 * nessuno ha dichiarato, e un titolo che si porta dentro del markup.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";
import {
  DIAGNOSTIC_KEYS,
  FILTRI_ID,
  appenaApertaMarkup,
  WS_TYPES,
  codaVoceMarkup,
  contaColonne,
  filtra,
  voceMarkup,
} from "../src/sections/segnalazioni-section.js";

test("ogni messaggio che la finestra manda passa dal ponte", () => {
  /* Un tipo non elencato nel ponte non arriva a Home Assistant: la finestra
   * risponderebbe «Message type not permitted through the bridge», e la
   * segnalazione morirebbe fra il browser e il backend. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      ALLOWED_MESSAGE_TYPES.includes(tipo),
      `${tipo} non e' nell'allowlist del ponte`,
    );
  }
});

test("i dieci comandi sono quelli che il backend registra", () => {
  assert.deepEqual([...WS_TYPES].sort(), [
    "dashboardmodern/tickets/answer",
    "dashboardmodern/tickets/auth/forget",
    "dashboardmodern/tickets/auth/poll",
    "dashboardmodern/tickets/auth/start",
    "dashboardmodern/tickets/create",
    "dashboardmodern/tickets/delete",
    "dashboardmodern/tickets/list",
    "dashboardmodern/tickets/queue",
    "dashboardmodern/tickets/sync",
    "dashboardmodern/tickets/thread",
  ]);
});

test("il gettone GitHub non compare fra le cose che la finestra manda", () => {
  /* La finestra chiede «apri una segnalazione», non «apri una segnalazione
   * con questo gettone»: il gettone sta nel deposito del backend e da li' non
   * esce. Se un giorno comparisse un comando che lo porta, si vede qui. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      !/token|gettone|secret/i.test(tipo),
      `${tipo} suona come un comando che porta un segreto`,
    );
  }
});

test("la diagnostica che la finestra puo' mandare e' una lista chiusa", () => {
  /* Le chiavi devono stare dentro quelle che il backend dichiara in
   * ticket_store.DIAGNOSTIC_KEYS. Qui ce ne sono cinque su sei: il metodo di
   * installazione il browser non lo sa, e non si inventa. */
  assert.deepEqual(
    [...DIAGNOSTIC_KEYS].sort(),
    ["ha_version", "integration_version", "locale", "panel_section", "user_agent"],
  );
});

test("nessuna chiave della diagnostica somiglia a un dato di casa", () => {
  /* Non una prova di stile: e' la lista che decide cosa esce di casa, e va
   * riletta ogni volta che qualcuno la allarga. */
  const vietate = ["url", "token", "password", "entity", "entities", "latitude"];
  for (const chiave of DIAGNOSTIC_KEYS) {
    for (const vietata of vietate) {
      assert.ok(
        !chiave.includes(vietata),
        `${chiave} somiglia troppo a ${vietata}: e' roba che non deve uscire`,
      );
    }
  }
});

function ticket(overrides = {}) {
  return {
    id: "abc",
    type: "bug",
    title: "Le tapparelle non si fermano",
    body: "Premo stop e continuano a scendere.",
    state: "inviato",
    created_at: Date.parse("2026-09-01T10:00:00Z"),
    reply: "",
    issue_url: "",
    delivery_error: "",
    ...overrides,
  };
}

test("il titolo dell'utente non diventa markup", () => {
  const markup = voceMarkup(
    ticket({ title: '<img src=x onerror="alert(1)">', body: "<b>grassetto</b>" }),
  );
  assert.ok(!markup.includes("<img"), "il tag e' arrivato intero nel markup");
  assert.ok(!markup.includes("<b>"), "il tag nel corpo e' arrivato intero");
  assert.ok(markup.includes("&lt;img"), "il tag doveva essere neutralizzato");
});

test("la risposta del manutentore non diventa markup", () => {
  const markup = voceMarkup(ticket({ reply: "<script>rubo()</script>" }));
  assert.ok(!markup.includes("<script>"));
  assert.ok(markup.includes("&lt;script"));
});

test("una segnalazione senza risposta non disegna il riquadro della risposta", () => {
  assert.ok(!voceMarkup(ticket()).includes("dm-tkt-risposta"));
  assert.ok(voceMarkup(ticket({ reply: "Riprodotta." })).includes("dm-tkt-risposta"));
});

test("il link alla discussione compare solo quando c'e'", () => {
  assert.ok(!voceMarkup(ticket()).includes("dm-tkt-link"));
  const promossa = voceMarkup(
    ticket({ issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/9" }),
  );
  assert.ok(promossa.includes("dm-tkt-link"));
  /* Un link che si apre altrove non deve poter toccare la finestra che lo ha
   * aperto. */
  assert.ok(promossa.includes('rel="noreferrer noopener"'));
});

test("la consegna fallita si legge sulla segnalazione", () => {
  const markup = voceMarkup(
    ticket({ state: "bozza", delivery_error: "Servizio non raggiungibile." }),
  );
  assert.ok(markup.includes("Servizio non raggiungibile."));
  assert.ok(markup.includes('data-stato="bozza"'));
});

test("ogni stato ha una sua etichetta", () => {
  for (const stato of ["bozza", "inviato", "in-carico", "risolto", "chiuso"]) {
    const markup = voceMarkup(ticket({ state: stato }));
    assert.ok(markup.includes(`data-stato="${stato}"`), `manca l'etichetta di ${stato}`);
  }
});


/* ─── Il cruscotto ─────────────────────────────────────────────────────────
 *
 * Tre numeri e un elenco filtrabile. Quello che si prova qui e' che i numeri
 * contino le cose giuste e che il filtro non nasconda quello che serve —
 * perche' un cruscotto che sbaglia il conto e' peggio di un cruscotto che non
 * c'e'.
 */

function inCoda(overrides = {}) {
  return {
    number: 1,
    type: "bug",
    title: "Le tapparelle non si fermano",
    body: "Premo stop e continuano a scendere.",
    state: "inviato",
    author: "anna-hub",
    issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/1",
    ...overrides,
  };
}

test("le tre colonne contano gli stati giusti", () => {
  const coda = [
    inCoda({ number: 1, state: "inviato" }),
    inCoda({ number: 2, state: "inviato" }),
    inCoda({ number: 3, state: "in-carico" }),
    inCoda({ number: 4, state: "risolto" }),
    inCoda({ number: 5, state: "chiuso" }),
  ];
  const conti = contaColonne(coda);
  assert.deepEqual(
    conti.map((colonna) => [colonna.id, colonna.quante]),
    [
      ["inviato", 2],
      ["in-carico", 1],
      /* Risolta e archiviata stanno insieme: per chi lavora la coda sono
       * tutte e due «non ci devo piu' tornare». */
      ["chiuse", 2],
    ],
  );
});

test("un conteggio su una coda vuota e' zero, non un buco", () => {
  assert.deepEqual(
    contaColonne([]).map((colonna) => colonna.quante),
    [0, 0, 0],
  );
});

test("il filtro «da lavorare» toglie quelle chiuse", () => {
  const coda = [
    inCoda({ number: 1, state: "inviato" }),
    inCoda({ number: 2, state: "in-carico" }),
    inCoda({ number: 3, state: "risolto" }),
    inCoda({ number: 4, state: "chiuso" }),
  ];
  assert.deepEqual(
    filtra(coda, "aperte").map((ticket) => ticket.number),
    [1, 2],
  );
});

test("«tutte» non toglie niente", () => {
  const coda = [inCoda({ number: 1, state: "risolto" })];
  assert.equal(filtra(coda, "tutte").length, 1);
});

test("i filtri per tipo tengono solo il loro tipo", () => {
  const coda = [
    inCoda({ number: 1, type: "bug" }),
    inCoda({ number: 2, type: "feature" }),
    inCoda({ number: 3, type: "assistenza" }),
  ];
  for (const [filtro, atteso] of [
    ["bug", [1]],
    ["feature", [2]],
    ["assistenza", [3]],
  ]) {
    assert.deepEqual(
      filtra(coda, filtro).map((ticket) => ticket.number),
      atteso,
      `il filtro ${filtro} non tiene quello che deve`,
    );
  }
});

test("ogni filtro dichiarato sa rispondere", () => {
  /* Un filtro nell'elenco che nessun ramo di `filtra` riconosce sarebbe un
   * tasto che svuota la coda senza dire perche'. */
  const coda = [inCoda({ type: "bug", state: "inviato" })];
  for (const filtro of FILTRI_ID) {
    assert.ok(Array.isArray(filtra(coda, filtro)), `${filtro} non torna un elenco`);
  }
});

test("una segnalazione chiusa non offre di richiuderla", () => {
  const aperta = codaVoceMarkup(inCoda({ state: "inviato" }));
  assert.ok(aperta.includes('data-dm-chiudi="risolto"'));
  assert.ok(aperta.includes('data-dm-chiudi="chiuso"'));
  const chiusa = codaVoceMarkup(inCoda({ state: "risolto" }));
  assert.ok(!chiusa.includes('data-dm-chiudi="risolto"'));
  assert.ok(!chiusa.includes('data-dm-chiudi="chiuso"'));
  /* Ma rispondere si puo' sempre: una segnalazione chiusa a cui arriva una
   * domanda merita una risposta. */
  assert.ok(chiusa.includes('data-dm-chiudi=""'));
});

test("il titolo e il corpo di chi segnala non diventano markup nella coda", () => {
  const markup = codaVoceMarkup(
    inCoda({ title: "<img src=x onerror=alert(1)>", body: "<script>rubo()</script>" }),
  );
  assert.ok(!markup.includes("<img"));
  assert.ok(!markup.includes("<script>"));
});

test("il nome di chi ha segnalato non diventa markup", () => {
  /* Arriva da GitHub, quindi da fuori: e' un nome che l'ha scelto qualcun
   * altro. */
  const markup = codaVoceMarkup(inCoda({ author: '"><b>oops</b>' }));
  assert.ok(!markup.includes("<b>oops</b>"));
});

test("ogni voce della coda porta il numero della issue nei suoi tasti", () => {
  /* E' quello che il comando manda al backend: sbagliarlo vuol dire
   * rispondere sotto la segnalazione di un altro. */
  const markup = codaVoceMarkup(inCoda({ number: 77 }));
  assert.ok(markup.includes('data-dm-rispondi="77"'));
  assert.ok(markup.includes('id="dm-tkt-risposta-77"'));
});


/* ─── Foto e video ─────────────────────────────────────────────────────────
 *
 * GitHub non ha un'API per allegarli, quindi la plancia non finge di
 * spedirli: manda alla pagina della segnalazione, dove il flusso ufficiale
 * esiste. Quello che si prova qui e' che il rimando ci sia e punti al posto
 * giusto.
 */

test("senza una segnalazione appena aperta il riquadro non c'e'", () => {
  assert.equal(appenaApertaMarkup(null), "");
});

test("il riquadro manda alla pagina della segnalazione appena aperta", () => {
  const markup = appenaApertaMarkup({
    numero: "197",
    url: "https://github.com/danigio15/dashboardmodern-v2/issues/197",
  });
  assert.ok(markup.includes("/issues/197"));
  assert.ok(markup.includes("#197"));
  /* Si apre altrove, e non deve poter toccare la finestra che l'ha aperto. */
  assert.ok(markup.includes('rel="noreferrer noopener"'));
  assert.ok(markup.includes('target="_blank"'));
});

test("il riquadro si puo' congedare", () => {
  /* Chi non ha una foto da allegare non deve trovarselo davanti per sempre. */
  const markup = appenaApertaMarkup({ numero: "1", url: "https://github.com/x/y/issues/1" });
  assert.ok(markup.includes('data-dm-tkt="congeda"'));
});

test("un indirizzo che arriva dal backend non diventa markup", () => {
  const markup = appenaApertaMarkup({
    numero: '"><script>rubo()</script>',
    url: '"><script>rubo()</script>',
  });
  assert.ok(!markup.includes("<script>"));
  assert.ok(markup.includes("&lt;script"));
});


/* ─── Vedere tutto ─────────────────────────────────────────────────────────
 *
 * Una segnalazione che ha dentro una schermata e' esattamente quella che si
 * salta, se niente lo dice. Quello che si prova qui e' che il segno ci sia
 * quando serve, che non ci sia quando non serve, e che gli indirizzi che
 * arrivano da GitHub non diventino markup.
 */

test("la graffetta compare solo dove c'e' un allegato", () => {
  assert.ok(codaVoceMarkup(inCoda({ attachments: 2, comments: 0 })).includes("📎 2"));
  const nuda = codaVoceMarkup(inCoda({ attachments: 0, comments: 0 }));
  assert.ok(!nuda.includes("📎"));
  assert.ok(!nuda.includes("💬"));
});

test("il contatore dei commenti compare solo dove ce ne sono", () => {
  assert.ok(codaVoceMarkup(inCoda({ comments: 3 })).includes("💬 3"));
  assert.ok(!codaVoceMarkup(inCoda({ comments: 0 })).includes("💬"));
});

test("un conteggio che non e' un numero non stampa NaN", () => {
  /* Arriva da GitHub: un campo mancante non deve diventare «📎 NaN». */
  const markup = codaVoceMarkup(inCoda({ attachments: undefined, comments: null }));
  assert.ok(!markup.includes("NaN"));
  assert.ok(!markup.includes("📎"));
});

test("ogni voce della coda offre di vedere tutto", () => {
  const markup = codaVoceMarkup(inCoda({ number: 77 }));
  assert.ok(markup.includes('data-dm-filo="77"'));
  assert.ok(markup.includes('aria-expanded="false"'));
});

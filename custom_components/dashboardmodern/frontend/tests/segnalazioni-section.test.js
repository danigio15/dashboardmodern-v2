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
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";
import {
  DIAGNOSTIC_KEYS,
  FILTRI_ID,
  allegatiMarkup,
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
    assert.ok(ALLOWED_MESSAGE_TYPES.includes(tipo), `${tipo} non e' nell'allowlist del ponte`);
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
  assert.deepEqual([...DIAGNOSTIC_KEYS].sort(), [
    "ha_version",
    "integration_version",
    "locale",
    "panel_section",
    "user_agent",
  ]);
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
    origin: "plancia",
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

test("il filtro «chiuse» tiene solo quelle chiuse", () => {
  const coda = [
    inCoda({ number: 1, state: "inviato" }),
    inCoda({ number: 2, state: "in-carico" }),
    inCoda({ number: 3, state: "risolto" }),
    inCoda({ number: 4, state: "chiuso" }),
  ];
  assert.deepEqual(
    filtra(coda, "chiuse").map((ticket) => ticket.number),
    [3, 4],
  );
});

test("«aperte» e «chiuse» insieme fanno la coda intera", () => {
  /* Due tasti che si dividono l'elenco senza perdere niente per strada: se
   * un giorno uno stato nuovo non finisse ne' di qua ne' di la', sparirebbe
   * da tutti e due i filtri senza che nessuno se ne accorga. */
  const coda = ["bozza", "inviato", "in-carico", "risolto", "chiuso"].map((state, indice) =>
    inCoda({ number: indice + 1, state }),
  );
  const divise = [...filtra(coda, "aperte"), ...filtra(coda, "chiuse")];
  assert.deepEqual(
    divise.map((ticket) => ticket.number).sort((a, b) => a - b),
    [1, 2, 3, 4, 5],
  );
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

test("una senza tipo non si traveste da difetto", () => {
  /* Le issue aperte a mano su GitHub spesso non hanno nessun tipo. Prendere
   * il primo dell'elenco vorrebbe dire chiamarle tutte «difetto», che e'
   * comodo e falso. */
  const ignota = codaVoceMarkup(inCoda({ type: "" }));
  assert.ok(!ignota.includes("🐞"), "una senza tipo mostra la coccinella");
  assert.ok(ignota.includes("--tk-rgb:113,113,122"), "manca la pastiglia grigia");
  const difetto = codaVoceMarkup(inCoda({ type: "bug" }));
  assert.ok(difetto.includes("🐞"), "un difetto ha perso la sua icona");
});

test("la coda dice se una segnalazione arriva da una plancia o da GitHub", () => {
  /* Non cambia cosa puoi fare — si risponde e si chiude allo stesso modo —
   * ma dice se chi ha scritto la risposta se la ritrovera' nella dashboard. */
  const dalla = codaVoceMarkup(inCoda({ origin: "plancia" }));
  assert.ok(dalla.includes("🏠"), "manca il segno della plancia");
  const daGithub = codaVoceMarkup(inCoda({ origin: "github" }));
  assert.ok(daGithub.includes("🐙"), "manca il segno di GitHub");
  assert.ok(!daGithub.includes("🏠"), "una da GitHub si dice anche dalla plancia");
});

test("anche una aperta a mano su GitHub si puo' rispondere e chiudere", () => {
  /* E' il punto di tutto il lavoro: un posto solo da guardare. Se le voci
   * venute da GitHub arrivassero senza tasti, la console tornerebbe a essere
   * meta' console. */
  const voce = codaVoceMarkup(inCoda({ origin: "github", type: "", number: 232 }));
  assert.ok(voce.includes('data-dm-rispondi="232"'), "non si puo' rispondere");
  assert.ok(voce.includes('data-dm-chiudi="risolto"'), "non si puo' risolvere");
  assert.ok(voce.includes('data-dm-chiudi="chiuso"'), "non si puo' archiviare");
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

test("un'immagine che non carica lascia il rimando, non un'eccezione", () => {
  /* Succede spesso: la CSP di Home Assistant blocca l'immagine, oppure GitHub
   * non risponde. Il ripiego deve mettere la classe «rotto» sul contenitore,
   * che e' quello che trasforma il riquadro vuoto in una riga con il link.
   *
   * Prima toglieva l'immagine e POI cercava il genitore — che a quel punto e'
   * `null`, perche' l'immagine non e' piu' attaccata a niente. Il gestore
   * moriva li' e la classe non arrivava mai. Nel browser non lo si vede: la
   * console del browser di solito non ce l'ha davanti nessuno. */
  const markup = allegatiMarkup([
    { kind: "image", url: "https://github.com/user-attachments/assets/x", name: "schermata" },
  ]);
  const gestore = markup.match(/onerror="([^"]*)"/);
  assert.ok(gestore, "l'immagine non ha nessun ripiego");

  const classi = [];
  const genitore = { classList: { add: (nome) => classi.push(nome) } };
  let staccata = false;
  const immagine = {
    parentElement: genitore,
    remove() {
      staccata = true;
      this.parentElement = null;
    },
  };
  new Function(gestore[1]).call(immagine);

  assert.ok(staccata, "l'immagine rotta e' rimasta al suo posto");
  assert.deepEqual(classi, ["rotto"], "il contenitore non e' stato segnato come rotto");
});

const sorgente = () =>
  readFile(new URL("../src/sections/segnalazioni-section.js", import.meta.url), "utf8");

test("nessun id compare due volte nella finestra", async () => {
  /* L'intestazione della finestra e il campo «Titolo» si chiamavano tutti e
   * due `dm-tkt-titolo`. `querySelector` restituisce il primo in ordine di
   * documento — l'intestazione — e un `<div>` non ha `.value`: il titolo
   * scritto si leggeva sempre come stringa vuota, e il modulo rispondeva
   * «Manca il titolo» a chi il titolo l'aveva appena messo.
   *
   * Un id ripetuto e' HTML non valido, e il modo in cui si rompe e' proprio
   * questo: silenzioso, e a distanza dal punto in cui e' stato scritto. */
  const testo = await sorgente();
  const visti = new Map();
  for (const trovato of testo.matchAll(/\bid="([^"$]+)"/g)) {
    const id = trovato[1];
    visti.set(id, (visti.get(id) ?? 0) + 1);
  }
  const doppi = [...visti].filter(([, quante]) => quante > 1).map(([id]) => id);
  assert.deepEqual(doppi, [], `id ripetuti: ${doppi.join(", ")}`);
});

test("ogni «for» di un'etichetta trova il suo campo", async () => {
  /* Un'etichetta che indica un id che non esiste — o che esiste ma su un
   * `<div>` — e' un'etichetta che non da' fuoco a niente quando la si preme. */
  const testo = await sorgente();
  const campi = new Set(
    [...testo.matchAll(/<(?:input|textarea|select)\s+id="([^"$]+)"/g)].map((m) => m[1]),
  );
  const etichette = [...testo.matchAll(/<label for="([^"$]+)"/g)].map((m) => m[1]);
  assert.ok(etichette.length, "nessuna etichetta trovata: la prova non sta guardando niente");
  for (const bersaglio of etichette) {
    assert.ok(campi.has(bersaglio), `l'etichetta «${bersaglio}» non indica nessun campo`);
  }
});

test("la bozza si rilegge dal campo, non dall'intestazione", async () => {
  /* La guardia di `raccogliBozza` deve cercare qualcosa che esiste SOLO
   * quando il modulo e' sulla pagina. Se cercasse l'intestazione — che c'e'
   * sempre — raccoglierebbe anche da «Le mie» e dalla console, scrivendo tre
   * stringhe vuote sopra una bozza che invece esiste. */
  const testo = await sorgente();
  const dentro = testo.slice(
    testo.indexOf("function raccogliBozza()"),
    testo.indexOf("function agganciaEventi("),
  );
  assert.ok(dentro.includes("#dm-tkt-campo-titolo"), "non legge il campo del titolo");
  assert.ok(
    !/querySelector\("#dm-tkt-titolo"\)/.test(dentro),
    "legge ancora l'intestazione della finestra",
  );
});

test("l'invito a rispondere non promette la plancia a chi non ce l'ha", async () => {
  /* Su una issue aperta a mano su GitHub la risposta li' resta. Dire al
   * manutentore che «chi l'ha aperta la trova nella sua plancia» sarebbe falso
   * proprio per le voci appena aggiunte, e gli farebbe credere di aver
   * avvisato qualcuno che invece non e' stato avvisato. */
  const dalla = codaVoceMarkup(inCoda({ origin: "plancia" }));
  assert.ok(dalla.includes("la trova nella sua plancia"), "l'invito di sempre e' sparito");

  const daGithub = codaVoceMarkup(inCoda({ origin: "github" }));
  assert.ok(
    !daGithub.includes("la trova nella sua plancia"),
    "promette la plancia a una issue aperta su GitHub",
  );
  assert.ok(daGithub.includes("su GitHub"), "non dice dove finisce davvero la risposta");
});

test("il collegamento dopo un invio non cancella il «Salvata»", async () => {
  /* La segnalazione e' gia' al sicuro in casa. Se l'autorizzazione non parte —
   * GitHub irraggiungibile — dire soltanto «non riuscita» farebbe credere di
   * aver perso quello che si era appena scritto, e la risposta naturale a quel
   * messaggio e' riscrivere tutto da capo: due segnalazioni uguali. */
  const testo = await sorgente();
  const dentro = testo.slice(
    testo.indexOf("async function collega("),
    testo.indexOf("function fermaAttesa("),
  );
  assert.ok(
    /if \(!salvata\) state\.avviso = "";/.test(dentro),
    "cancella l'avviso anche quando arriva da un invio appena salvato",
  );
  assert.ok(
    dentro.includes("Salvata, ma l'autorizzazione non e' partita:"),
    "il guasto non dice piu' che la segnalazione e' al sicuro",
  );
  assert.ok(
    testo.includes("await collega({ salvata: true })"),
    "l'invio non dice a `collega` che c'e' gia' una segnalazione salvata",
  );
});

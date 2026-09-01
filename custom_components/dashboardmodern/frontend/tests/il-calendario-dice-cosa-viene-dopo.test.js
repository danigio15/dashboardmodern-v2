/* Il calendario dice cosa viene dopo (#259).
 *
 * «Possibilita' di visualizzare gli eventi del calendario che ho gia'
 * configurato in HA. Magari visualizzando gli ultimi 2 eventi su widget che
 * cliccandoci si apre una lista giorni/giorno e un elenco tipo come gia'
 * esistente "Da Fare".»
 *
 * Queste prove tengono ferme le due cose che, sbagliate, fanno mentire
 * l'elenco: un evento di tutto il giorno finito nel giorno prima, e un evento
 * in corso buttato via perche' «e' passato».
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CALENDARI_KEY,
  GIORNI_AVANTI,
  chiaveDelGiorno,
  etichettaDelGiorno,
  eventiDaQui,
  inCorso,
  isCalendarEntity,
  istanteDi,
  minutiAllEvento,
  normalizzaCalendari,
  oraDellEvento,
  PAROLE_CALENDARIO,
  ordinaEventi,
  parseCalendarEventsResponse,
  perGiorno,
  prossimiEventi,
  suggerisciCalendari,
} from "../src/core/calendario-model.js";
import { fraseDellaTessera, verdettoDellaTessera } from "../src/core/racconto-tessera.js";
import { haOggettoWidget } from "../src/core/oggetti-widget.js";

/* Un giorno fisso, costruito nel fuso di chi esegue la prova: se lo si
 * scrivesse in UTC, la prova direbbe cose diverse a Roma e a Chicago — che e'
 * esattamente il difetto contro cui e' scritta. */
const ADESSO = new Date(2026, 8, 1, 14, 0, 0).getTime();
const ORA = (giorno, ore, minuti = 0) =>
  new Date(2026, 8, giorno, ore, minuti, 0).toISOString().slice(0, 19);

const RISPOSTA = {
  response: {
    "calendar.casa": {
      events: [
        { start: ORA(1, 13, 30), end: ORA(1, 15), summary: "Riunione in corso" },
        { start: ORA(1, 18), end: ORA(1, 19), summary: "Palestra", location: "Via Verdi 3" },
        { start: "2026-09-02", end: "2026-09-03", summary: "Ferie" },
        { start: ORA(1, 9), end: ORA(1, 10), summary: "Gia' finito" },
        { start: ORA(5, 20, 30), end: ORA(5, 23), summary: "Cena" },
      ],
    },
  },
};

test("una data secca e' mezzanotte di chi guarda, non di Greenwich", () => {
  /* «2026-09-02» e' l'inizio del 2 settembre per chi legge. Letta come istante
   * UTC, a ovest di Greenwich quell'evento scivolerebbe alla sera del primo. */
  const capo = istanteDi("2026-09-02");
  assert.equal(capo.tuttoIlGiorno, true);
  assert.equal(chiaveDelGiorno(capo.istante), "2026-09-02");
  assert.equal(new Date(capo.istante).getHours(), 0);
  // Un'ora dichiarata resta un'ora, e non diventa un giorno intero.
  const conOra = istanteDi(ORA(2, 9, 30));
  assert.equal(conOra.tuttoIlGiorno, false);
  assert.equal(chiaveDelGiorno(conOra.istante), "2026-09-02");
  // Quello che non si capisce non si inventa.
  assert.deepEqual(istanteDi(""), { istante: null, tuttoIlGiorno: false });
  assert.deepEqual(istanteDi("domani"), { istante: null, tuttoIlGiorno: false });
});

test("la risposta del servizio si legge, e una storta non rompe il disegno", () => {
  const eventi = parseCalendarEventsResponse(RISPOSTA, "calendar.casa");
  assert.equal(eventi.length, 5);
  assert.equal(eventi[0].summary, "Riunione in corso");
  assert.equal(eventi[1].location, "Via Verdi 3");
  assert.equal(eventi[2].tuttoIlGiorno, true);
  // Servizio mancante, entita' sbagliata, risposta vuota: elenco vuoto.
  assert.deepEqual(parseCalendarEventsResponse(null, "calendar.casa"), []);
  assert.deepEqual(parseCalendarEventsResponse({}, "calendar.casa"), []);
  assert.deepEqual(parseCalendarEventsResponse(RISPOSTA, "calendar.altro"), []);
  // Un evento senza inizio non e' un evento: si scarta, non si mette a zero.
  assert.deepEqual(
    parseCalendarEventsResponse(
      { response: { "calendar.x": { events: [{ summary: "Senza quando" }] } } },
      "calendar.x",
    ),
    [],
  );
});

test("un evento in corso non e' passato", () => {
  const eventi = parseCalendarEventsResponse(RISPOSTA, "calendar.casa");
  const restano = eventiDaQui(eventi, ADESSO);
  /* E' il piu' importante di tutti — e' quello dentro cui si sta — e buttarlo
   * via perche' e' cominciato prima di adesso vorrebbe dire nascondere la
   * riunione in cui si sta guardando la plancia. */
  assert.equal(restano[0].summary, "Riunione in corso");
  assert.equal(inCorso(restano[0], ADESSO), true);
  // Quello finito stamattina invece non c'e' piu'.
  assert.ok(!restano.some((evento) => evento.summary === "Gia' finito"));
  assert.equal(restano.length, 4);
});

test("i due della tessera sono i due che contano", () => {
  const eventi = parseCalendarEventsResponse(RISPOSTA, "calendar.casa");
  const primi = prossimiEventi(eventi, ADESSO, 2);
  assert.deepEqual(
    primi.map((evento) => evento.summary),
    ["Riunione in corso", "Palestra"],
  );
  assert.equal(prossimiEventi(eventi, ADESSO, 0).length, 0);
  assert.equal(minutiAllEvento(primi[1], ADESSO), 240);
  // In corso vuol dire minuti negativi: la frase decide come dirlo.
  assert.ok(minutiAllEvento(primi[0], ADESSO) < 0);
});

test("i giorni si raccolgono come l'elenco delle cose da fare", () => {
  const eventi = parseCalendarEventsResponse(RISPOSTA, "calendar.casa");
  const giorni = perGiorno(eventi, ADESSO);
  assert.deepEqual(
    giorni.map(({ giorno }) => giorno),
    ["2026-09-01", "2026-09-02", "2026-09-05"],
  );
  assert.deepEqual(
    giorni[0].eventi.map((evento) => evento.summary),
    ["Riunione in corso", "Palestra"],
  );
  /* Le ferie di piu' giorni compaiono nel giorno in cui cominciano, non in
   * tutti quelli che attraversano: ripeterle farebbe righe uguali per una
   * vacanza sola. */
  assert.equal(giorni[1].eventi.length, 1);
  // E i giorni senza niente non lasciano un blocco vuoto: non ci sono.
  assert.ok(!giorni.some(({ giorno }) => giorno === "2026-09-03"));
});

test("oggi e domani si dicono con la parola, poi si scrive la data", () => {
  assert.equal(etichettaDelGiorno("2026-09-01", ADESSO), "Oggi");
  assert.equal(etichettaDelGiorno("2026-09-02", ADESSO), "Domani");
  /* Le parole arrivano da chi disegna, non dal nucleo: il raccoglitore delle
   * traduzioni guarda le sezioni, e una `t()` scritta qui dentro non
   * finirebbe nei cataloghi — «Oggi» resterebbe italiano per tutti. */
  assert.equal(etichettaDelGiorno("2026-09-01", ADESSO, { oggi: "Today" }), "Today");
  assert.deepEqual(Object.keys(PAROLE_CALENDARIO).sort(), ["domani", "oggi", "tuttoIlGiorno"]);
  /* Dal terzo giorno in poi la parola non c'e' piu' — «dopodomani» in un
   * elenco lungo confonde — e si scrive la data, che e' quello che si
   * cercherebbe su un'agenda. */
  const lontano = etichettaDelGiorno("2026-09-05", ADESSO, undefined, "it-IT");
  assert.match(lontano, /5/);
  assert.doesNotMatch(lontano, /Oggi|Domani/);
});

test("un evento di tutto il giorno non ha un'ora da mostrare", () => {
  const eventi = parseCalendarEventsResponse(RISPOSTA, "calendar.casa");
  const ferie = eventi.find((evento) => evento.summary === "Ferie");
  assert.equal(oraDellEvento(ferie), "Tutto il giorno");
  assert.equal(oraDellEvento(ferie, { tuttoIlGiorno: "All day" }), "All day");
  const palestra = eventi.find((evento) => evento.summary === "Palestra");
  assert.match(oraDellEvento(palestra, undefined, "it-IT"), /18:00.+19:00/);
  /* Un promemoria che finisce quando comincia non ha una durata: «18:00 –
   * 18:00» sarebbe una riga che si prende in giro. */
  const puntuale = { inizio: palestra.inizio, fine: palestra.inizio, tuttoIlGiorno: false };
  assert.equal(oraDellEvento(puntuale, undefined, "it-IT"), "18:00");
});

test("i calendari si riconoscono e si ripuliscono", () => {
  assert.equal(isCalendarEntity("calendar.famiglia"), true);
  assert.equal(isCalendarEntity("todo.spesa"), false);
  assert.equal(isCalendarEntity(""), false);
  const puliti = normalizzaCalendari([
    { name: "  Famiglia  ", entity: " calendar.famiglia " },
    { entity: "sensor.no" },
    { entity_id: "calendar.lavoro", colore: "#0ea5e9" },
  ]);
  assert.equal(puliti.length, 2);
  assert.equal(puliti[0].name, "Famiglia");
  assert.equal(puliti[1].colore, "#0ea5e9");
  // Una riga senza id ne riceve uno suo: serve a distinguerla nell'editor.
  assert.ok(puliti[0].id);
  assert.deepEqual(normalizzaCalendari(null), []);
});

test("quello che Home Assistant ha gia' non si riscrive a mano", () => {
  const stati = {
    "calendar.famiglia": { attributes: { friendly_name: "Famiglia" } },
    "calendar.rifiuti": { attributes: {} },
    "todo.spesa": { attributes: { friendly_name: "Spesa" } },
  };
  const trovati = suggerisciCalendari(stati, [{ entity: "calendar.famiglia" }]);
  assert.deepEqual(
    trovati.map((voce) => voce.entity),
    ["calendar.rifiuti"],
  );
  // Senza nome amichevole si legge quello dell'entita', non si lascia vuoto.
  assert.equal(trovati[0].name, "rifiuti");
});

test("l'ordine e' quello in cui le cose succedono", () => {
  const eventi = ordinaEventi([
    { inizio: 300, fine: 400 },
    { inizio: 100, fine: 900 },
    { inizio: 100, fine: 200 },
  ]);
  assert.deepEqual(
    eventi.map((evento) => [evento.inizio, evento.fine]),
    [
      [100, 200],
      [100, 900],
      [300, 400],
    ],
  );
  assert.deepEqual(ordinaEventi(null), []);
});

test("la finestra non conta eventi: dice cosa viene dopo", () => {
  const adesso = Date.now();
  const evento = (summary, da, a) => ({
    summary,
    inizio: adesso + da * 60000,
    fine: adesso + a * 60000,
  });
  const corso = {
    key: "calendario",
    primi: [evento("Riunione", -20, 40), evento("Palestra", 240, 300)],
    attiva: true,
  };
  const frase = fraseDellaTessera(corso, undefined, adesso);
  assert.match(frase, /«Riunione» e' in corso/);
  assert.match(frase, /«Palestra»/);
  // E non «due su due in funzione», che di un calendario non e' una notizia.
  assert.doesNotMatch(frase, /in funzione/);
  assert.equal(verdettoDellaTessera(corso).tono, "corso");

  assert.match(
    fraseDellaTessera({ key: "calendario", primi: [evento("Dentista", 40, 100)] }, undefined, adesso),
    /comincia fra 40 minuti/,
  );
  assert.match(
    fraseDellaTessera({ key: "calendario", primi: [] }, undefined, adesso),
    /niente in programma/,
  );
  assert.match(
    fraseDellaTessera({ key: "calendario", primi: [], inArrivo: true }, undefined, adesso),
    /agenda/,
  );
});

test("la tessera mostra i due eventi, non un conteggio da solo", async () => {
  const source = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* «Visualizzando gli ultimi 2 eventi su widget»: i due stanno nella
   * didascalia con la loro ora davanti, perche' un appuntamento senza il
   * titolo non e' un appuntamento. */
  assert.match(source, /return primi\.map\(scritto\)\.join\(" {2}· {2}"\);/);
  // Il numero grande e' quanti ne restano oggi, che risponde a «sono libero?».
  assert.match(source, /diOggi\.length \? t\(`\$\{diOggi\.length\} oggi`/);
  /* Nessun anello: una percentuale di appuntamenti non vuol dire niente, e un
   * cerchio pieno a caso e' peggio di un cerchio che non c'e'. */
  assert.match(source, /key: "calendario",[\s\S]{0,900}?ring: null/);
  // Il disegno c'e': la tessera non resta col simbolo di ripiego.
  assert.equal(haOggettoWidget("calendario"), true);
});

test("gli eventi si chiedono al servizio, non allo stato dell'entita'", async () => {
  const source = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* Lo stato di un `calendar.*` e' `on`/`off` e negli attributi porta un
   * evento solo: l'elenco lo si chiede a `calendar.get_events`, come le voci
   * delle liste ToDo si chiedono a `todo.get_items`. */
  assert.match(source, /service: "get_events"/);
  assert.match(source, /return_response: true/);
  /* La finestra si chiede in ora locale: un ISO con la Z chiederebbe una
   * finestra spostata dal fuso di chi guarda, e il primo giorno dell'elenco
   * sarebbe quello sbagliato. */
  assert.match(source, /function orarioPerIlServizio\(istante\)/);
  assert.doesNotMatch(source, /start_date_time: new Date\([^)]*\)\.toISOString/);
  assert.equal(GIORNI_AVANTI, 30);
});

test("il calendario ha una pagina sua, non solo una tessera", async () => {
  const sezione = await readFile(
    new URL("../src/sections/calendario-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /export const CALENDARIO_PAGE_ID = "page-calendario"/);
  assert.match(sezione, /pagina\.className = "page"/);
  assert.match(sezione, /voce\.addEventListener\("click"/);
  // Senza calendari scelti la voce non c'e': una pagina vuota non si offre.
  assert.match(sezione, /const serve = calendarioConfigurato\(\) && sezioneAccesa\(\)/);
  /* E il `display` di quella voce ha un padrone solo: `cdApplyNavVis` non la
   * conosce, o gliela cancellerebbe ogni tre secondi. */
  assert.doesNotMatch(sezione, /cdNavVisMap/);
  assert.match(sezione, /readJson\("cd_sections", \{\}\)/);
  /* Gli eventi NON si rileggono nella pagina: li chiede gia' il filo della
   * Home, e due padroni per la stessa richiesta vorrebbero dire due risposte
   * che ogni tanto non si assomigliano. */
  assert.match(sezione, /eventiDeiCalendari/);
  assert.doesNotMatch(sezione, /get_events/);

  const testate = await readFile(
    new URL("../src/sections/page-masthead-section.js", import.meta.url),
    "utf8",
  );
  assert.match(testate, /id: "page-calendario"/);
});

test("la chiave nuova viaggia con la configurazione", async () => {
  const persistenza = await readFile(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, /"cd_calendari"/);
  assert.equal(CALENDARI_KEY, "cd_calendari");
});

test("le parole del calendario si dicono nelle sezioni, o restano italiane", async () => {
  const nucleo = await readFile(
    new URL("../src/core/calendario-model.js", import.meta.url),
    "utf8",
  );
  /* `scripts/extract-i18n-keys.mjs` raccoglie le chiamate a `t` scritte nelle
   * SEZIONI: una scritta qui non finirebbe nei cataloghi, e per un tedesco il
   * titolo del giorno resterebbe «Oggi». Il nucleo percio' non ha nessun modo
   * di tradurre: non importa niente, ed e' quello che lo tiene onesto. */
  const codice = nucleo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(codice, /\bt\(/);
  assert.doesNotMatch(codice, /from "\.\.\/sections\//);
  for (const nome of ["home-widgets-section.js", "calendario-section.js"]) {
    const sezione = await readFile(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");
    assert.match(sezione, /t\("Oggi", "Today"\)/, nome);
    assert.match(sezione, /t\("Domani", "Tomorrow"\)/, nome);
    assert.match(sezione, /t\("Tutto il giorno", "All day"\)/, nome);
  }
});

test("la spiegazione del calendario non se la prende quella degli avvisi", async () => {
  const editor = await readFile(
    new URL("../src/sections/todo-editor-section.js", import.meta.url),
    "utf8",
  );
  /* `potaGruppiOrfani` riscrive la spiegazione degli avvisi cercandola come
   * «la prima ed-intro dopo un separatore»: col calendario in mezzo, quella
   * ricerca trovava la sua e la sostituiva con un testo che parla di sensori
   * di allagamento. Adesso il separatore degli avvisi ha un nome suo. */
  assert.match(editor, /dm-avvisi-ed-sep ~ \.ed-intro/);
  assert.match(editor, /dm-widget-ed-sep dm-avvisi-ed-sep/);
});

/* ── il calendario si tocca, non si guarda soltanto ────────────────────────
 *
 * «Il popup del widget deve dare la possibilita' di modificare e di interagire
 * con il calendario.» Un'agenda che si legge e basta e' mezza agenda.
 */

test("i tasti seguono quello che il calendario accetta davvero", async () => {
  const { CAPACITA, capacitaDelCalendario, eventoCancellabile, eventoModificabile } = await import(
    "../src/core/calendario-model.js"
  );
  assert.deepEqual({ ...CAPACITA }, { CREA: 1, CANCELLA: 2, MODIFICA: 4 });
  const tutto = capacitaDelCalendario({ attributes: { supported_features: 7 } });
  assert.deepEqual({ ...tutto }, { crea: true, cancella: true, modifica: true });
  /* Google accetta eventi nuovi e non li lascia cancellare da qui; quello
   * delle festivita' non accetta niente. Un tasto che poi risponde «non
   * supportato» e' peggio che non mostrarlo. */
  const soloNuovi = capacitaDelCalendario({ attributes: { supported_features: 1 } });
  assert.deepEqual({ ...soloNuovi }, { crea: true, cancella: false, modifica: false });
  const solaLettura = capacitaDelCalendario({});
  assert.deepEqual({ ...solaLettura }, { crea: false, cancella: false, modifica: false });

  /* E senza `uid` non si tocca niente comunque: e' il nome proprio con cui si
   * dice a Home Assistant QUALE evento si intende, e gli eventi letti dal
   * servizio non ce l'hanno. */
  const conNome = { uid: "abc" };
  const senzaNome = { uid: "" };
  assert.equal(eventoModificabile(conNome, tutto), true);
  assert.equal(eventoModificabile(senzaNome, tutto), false);
  assert.equal(eventoCancellabile(conNome, soloNuovi), false);
  assert.equal(eventoCancellabile(conNome, tutto), true);
});

test("solo la porta HTTP porta l'uid, e per questo la si prova per prima", async () => {
  const { parseCalendarApiEvents } = await import("../src/core/calendario-model.js");
  const letti = parseCalendarApiEvents(
    [
      {
        uid: "u1",
        summary: "Palestra",
        location: "Via Verdi 3",
        start: { dateTime: "2026-09-01T18:00:00+02:00" },
        end: { dateTime: "2026-09-01T19:00:00+02:00" },
      },
      { uid: "u2", summary: "Ferie", start: { date: "2026-09-02" }, end: { date: "2026-09-03" } },
    ],
    "calendar.casa",
  );
  assert.equal(letti[0].uid, "u1");
  /* La forma `{date: …}` E' la dichiarazione di «tutto il giorno»: non si
   * indovina dalla durata, la si legge. */
  assert.equal(letti[1].tuttoIlGiorno, true);
  assert.equal(letti[0].tuttoIlGiorno, false);
  assert.deepEqual(parseCalendarApiEvents(null, "calendar.casa"), []);

  const home = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* Dentro Home Assistant la plancia non possiede nessun gettone e ogni
   * chiamata REST torna 401: il percorso si fa firmare dal socket, come le
   * immagini. */
  assert.match(home, /type: "auth\/sign_path"/);
  assert.match(home, /\/api\/calendars\//);
  // E se non ci si arriva, resta il servizio: si legge, non si scrive.
  assert.match(home, /service: "get_events"/);
});

test("una bozza torna evento senza spostare niente di un giorno", async () => {
  const { bozzaDaEvento, bozzaNuova, messaggioDellEvento } = await import(
    "../src/core/calendario-model.js"
  );
  const ferie = {
    entity: "calendar.casa",
    uid: "u2",
    summary: "Ferie",
    inizio: new Date(2026, 8, 2).getTime(),
    /* Come la manda Home Assistant: la fine e' ESCLUSIVA, il giorno dopo
     * l'ultimo. */
    fine: new Date(2026, 8, 5).getTime(),
    tuttoIlGiorno: true,
  };
  const bozza = bozzaDaEvento(ferie);
  /* Nel modulo si mostra l'ultimo giorno vero: mostrare il 5 direbbe a chi
   * guarda che le ferie finiscono un giorno piu' tardi di quando finiscono. */
  assert.equal(bozza.giornoInizio, "2026-09-02");
  assert.equal(bozza.giornoFine, "2026-09-04");
  // E salvandola senza toccare niente torna esattamente com'era.
  const { evento } = messaggioDellEvento(bozza);
  assert.equal(evento.dtstart, "2026-09-02");
  assert.equal(evento.dtend, "2026-09-05");

  // Un impegno nuovo parte dalla mezz'ora tonda: nessuno segna alle 14:37.
  const nuova = bozzaNuova("calendar.casa", new Date(2026, 8, 1, 14, 37).getTime());
  assert.equal(nuova.oraInizio, "15:00");
  assert.equal(nuova.oraFine, "16:00");
  assert.equal(nuova.uid, "");
});

test("il modulo si lamenta invece di mandare una cosa storta", async () => {
  const { bozzaNuova, messaggioDellEvento } = await import("../src/core/calendario-model.js");
  const base = bozzaNuova("calendar.casa", new Date(2026, 8, 1, 10, 0).getTime());
  assert.match(messaggioDellEvento(base).errore, /titolo/i);
  assert.match(messaggioDellEvento({ ...base, entity: "", summary: "X" }).errore, /calendario/i);
  assert.match(
    messaggioDellEvento({ ...base, summary: "X", giornoInizio: "" }).errore,
    /data/i,
  );
  /* Un impegno che finisce prima di cominciare non si manda: Home Assistant lo
   * rifiuterebbe, e il rifiuto arriverebbe come una parola in inglese. */
  assert.match(
    messaggioDellEvento({ ...base, summary: "X", oraFine: "09:00" }).errore,
    /finisce prima/i,
  );
  // Le parole del lamento arrivano da chi disegna, come tutte le altre.
  assert.equal(
    messaggioDellEvento({ ...base }, { titolo: "A title is required." }).errore,
    "A title is required.",
  );
  // E una bozza in ordine passa.
  assert.ok(messaggioDellEvento({ ...base, summary: "Cena" }).evento);
});

test("i tre comandi passano il ponte, e si vedono scritti per intero", async () => {
  const modifica = await readFile(
    new URL("../src/sections/calendario-modifica-section.js", import.meta.url),
    "utf8",
  );
  /* La guardia del ponte cerca le stringhe nel codice: un `nuovo ? a : b`
   * dentro `type:` nasconderebbe due comandi su tre alla prova, e poi dentro
   * Home Assistant il messaggio verrebbe respinto. */
  for (const comando of ["create", "update", "delete"])
    assert.match(modifica, new RegExp(`type: "calendar/event/${comando}"`), comando);

  const ponte = await readFile(
    new URL("../src/legacy/bridge-socket.js", import.meta.url),
    "utf8",
  );
  for (const comando of ["create", "update", "delete"])
    assert.match(ponte, new RegExp(`"calendar/event/${comando}"`), comando);
});

test("il modulo e i tasti stanno in un posto solo, e li usano in due", async () => {
  const modifica = await readFile(
    new URL("../src/sections/calendario-modifica-section.js", import.meta.url),
    "utf8",
  );
  /* I posti da cui si scrive sono due — la finestra della tessera e la pagina
   * — e sono esattamente gli stessi gesti: due copie sarebbero due modi di
   * segnare un impegno, e uno dei due si dimenticherebbe di un fuso. */
  for (const nome of ["moduloMarkup", "azioniDellEventoMarkup", "tastoNuovoMarkup"])
    assert.match(modifica, new RegExp(`export function ${nome}\\b`), nome);
  for (const ospite of ["home-widgets-section.js", "calendario-section.js"]) {
    const sorgente = await readFile(new URL(`../src/sections/${ospite}`, import.meta.url), "utf8");
    assert.match(sorgente, /from "\.\/calendario-modifica-section\.js"/, ospite);
    assert.match(sorgente, /moduloMarkup\(/, ospite);
    assert.match(sorgente, /azioniDellEventoMarkup\(/, ospite);
    /* Ognuno dice come si ridisegna: il modulo non sa dove sta, e non deve
     * saperlo. */
    assert.match(sorgente, /registraOspiteCalendario\(/, ospite);
  }
});

test("il gettone si va a prendere in un posto solo", async () => {
  /* Questa funzione stava copiata identica in tre sezioni — telecamere,
   * immagini, mappa del robot — e ne stava per nascere una quarta per gli
   * eventi. Dove si va a prendere il gettone e' una domanda con una risposta,
   * non quattro uguali che un giorno divergono. */
  const shared = await readFile(new URL("../src/sections/shared.js", import.meta.url), "utf8");
  assert.match(shared, /export function gettoneDiAccesso\(\)/);
  assert.match(shared, /export function chiediAHomeAssistant\(/);
  for (const nome of ["live-ui-section.js", "media-picker-section.js", "robot-section.js"]) {
    const sorgente = await readFile(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");
    assert.doesNotMatch(sorgente, /function authToken\(\)/, nome);
    assert.match(sorgente, /gettoneDiAccesso/, nome);
  }
});

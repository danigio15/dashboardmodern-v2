/* Il calendario cambia con la persona che lo guarda (#344).
 *
 * «Sarebbe possibile implementare una soluzione in cui il calendario mostrato
 * dalla dashboard vari in base alla persona che lo sta visualizzando? Utente 1
 * visualizza calendar.utente1, Utente 2 visualizza calendar.utente2, con la
 * possibilita' di scegliere quale calendario verra' mostrato ad ogni utente.»
 *
 * Due meta'. La prima e' la mappatura — di chi e' un calendario — e sta nel
 * nucleo, dove si prova senza browser. La seconda e' sapere CHI guarda: dentro
 * il pannello lo sa il documento ospite, non questo, e la plancia lo chiede in
 * due modi (l'ospite, se un giorno lo consegna; la persona stessa, una volta,
 * con la risposta scritta nel suo profilo di Home Assistant).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  TUTTA_LA_CASA,
  calendariAssegnati,
  calendariDellUtente,
  normalizzaCalendari,
  persone,
  utentiDiCasa,
} from "../src/core/calendario-model.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

const CASA = [
  { id: "c1", entity: "calendar.famiglia", name: "Famiglia" },
  { id: "c2", entity: "calendar.utente1", name: "Mario", persone: ["u-mario"] },
  { id: "c3", entity: "calendar.utente2", name: "Anna", persone: ["u-anna"] },
];

const nomi = (elenco) => elenco.map((voce) => voce.entity);

test("un calendario puo' essere di qualcuno, e vuoto vuol dire di casa", () => {
  const scritti = normalizzaCalendari([
    { entity: "calendar.famiglia" },
    { entity: "calendar.utente1", persone: ["u-mario", "u-mario", " "] },
    /* Salvato dalla riga della scheda arriva come una stringa: e' una casella
     * nascosta come le altre, e la riga legge stringhe. */
    { entity: "calendar.utente2", persone: "u-anna, u-mario" },
  ]);
  assert.deepEqual(scritti[0].persone, []);
  assert.deepEqual(scritti[1].persone, ["u-mario"]);
  assert.deepEqual(scritti[2].persone, ["u-anna", "u-mario"]);
  /* E chi ha configurato un calendario prima di oggi non ha niente addosso. */
  assert.equal(calendariAssegnati(normalizzaCalendari([{ entity: "calendar.x" }])), false);
  assert.equal(calendariAssegnati(scritti), true);
  assert.deepEqual(persone(undefined), []);
});

test("chi si riconosce vede i suoi e quelli di casa; chi non si riconosce vede quelli di casa", () => {
  /* «Utente 1 visualizza calendar.utente1, Utente 2 visualizza
   * calendar.utente2»: e il calendario di famiglia lo guardano tutti e due —
   * toglierlo a chi ne ha anche uno suo sarebbe peggio che non aver diviso. */
  assert.deepEqual(nomi(calendariDellUtente(CASA, "u-mario")), [
    "calendar.famiglia",
    "calendar.utente1",
  ]);
  assert.deepEqual(nomi(calendariDellUtente(CASA, "u-anna")), [
    "calendar.famiglia",
    "calendar.utente2",
  ]);
  /* Senza sapere chi guarda restano quelli di casa: e' la plancia al muro. */
  assert.deepEqual(nomi(calendariDellUtente(CASA, "")), ["calendar.famiglia"]);
  /* «Tutta la casa» e' una risposta anche lei, e vuol dire tutto. */
  assert.deepEqual(nomi(calendariDellUtente(CASA, TUTTA_LA_CASA)), [
    "calendar.famiglia",
    "calendar.utente1",
    "calendar.utente2",
  ]);
  /* Un utente che non ha niente di suo vede comunque la casa. */
  assert.deepEqual(nomi(calendariDellUtente(CASA, "u-ospite")), ["calendar.famiglia"]);
  /* E senza nessuna divisione non cambia niente per nessuno. */
  const tuttiDiCasa = [{ entity: "calendar.a" }, { entity: "calendar.b" }];
  assert.deepEqual(nomi(calendariDellUtente(tuttiDiCasa, "")), ["calendar.a", "calendar.b"]);
});

test("se ogni calendario ha un padrone, chi non si riconosce non resta a mani vuote", () => {
  /* Una plancia che non sa chi ha davanti non deve diventare una pagina
   * vuota: questa e' una comodita', non una serratura. */
  const soloPersonali = [
    { entity: "calendar.utente1", persone: ["u-mario"] },
    { entity: "calendar.utente2", persone: ["u-anna"] },
  ];
  assert.deepEqual(nomi(calendariDellUtente(soloPersonali, "")), [
    "calendar.utente1",
    "calendar.utente2",
  ]);
  assert.deepEqual(nomi(calendariDellUtente(soloPersonali, "u-anna")), ["calendar.utente2"]);
});

test("gli utenti di casa escono dalle persone di Home Assistant", () => {
  /* Non c'e' un elenco degli utenti che la plancia possa chiedere: ogni
   * `person.*` pero' porta negli attributi l'`user_id` di chi rappresenta. */
  const stati = {
    "person.mario": { state: "home", attributes: { friendly_name: "Mario", user_id: "u-mario" } },
    "person.anna": { state: "not_home", attributes: { friendly_name: "Anna", user_id: "u-anna" } },
    /* Una persona senza utente non e' un utente: nessuno le assegna niente. */
    "person.nonno": { state: "home", attributes: { friendly_name: "Nonno" } },
    "sensor.qualcosa": { state: "1", attributes: { user_id: "u-falso" } },
  };
  assert.deepEqual(
    utentiDiCasa(stati).map((voce) => [voce.name, voce.utente]),
    [
      ["Anna", "u-anna"],
      ["Mario", "u-mario"],
    ],
  );
  assert.deepEqual(utentiDiCasa({}), []);
});

test("la scheda dell'agenda dice di chi e' ogni calendario (#344)", async () => {
  const editor = await leggi("sections/agenda-editor-section.js");
  assert.match(editor, /data-cal-persone\b/);
  assert.match(editor, /data-cal-field="persone"/);
  assert.match(editor, /data-cal-persona=/);
  assert.match(editor, /utentiDiCasa\(allStates\(\)\)/);
  /* Salvato e' un elenco, non la stringa che la riga porta. */
  assert.match(editor, /letta\.persone = persone\(letta\);/);
});

test("chi guarda decide quali calendari escono, e lo si chiede in due modi (#344)", async () => {
  const home = await leggi("sections/home-widgets-section.js");
  /* La prima strada: l'ospite consegna l'utente collegato. Dentro il pannello
   * `hass.user` vive di la', e il documento della plancia riceve un ponte. */
  assert.match(home, /__DASHBOARDMODERN_UTENTE__/);
  /* La seconda, che funziona oggi: la scelta si scrive nel profilo di Home
   * Assistant di CHI E' COLLEGATO, non su questo dispositivo. */
  assert.match(home, /type: "frontend\/get_user_data", key: CHIAVE_CHI_GUARDA/);
  assert.match(home, /type: "frontend\/set_user_data",/);
  assert.match(home, /const CHIAVE_CHI_GUARDA = "dashboardmodern_calendario_utente";/);
  /* E i calendari che si disegnano sono quelli di chi guarda. */
  assert.match(home, /return calendariDellUtente\(calendariScritti\(\), utenteCheGuarda\(\)\);/);
  /* La domanda si fa solo se qualcuno ha davvero diviso i calendari. */
  assert.match(home, /if \(calendariAssegnati\(calendariScritti\(\)\)\) chiediChiGuarda\(\);/);

  const pagina = await leggi("sections/calendario-section.js");
  assert.match(pagina, /function chiGuardaMarkup/);
  assert.match(pagina, /data-dm-calp-chi=/);
  assert.match(pagina, /ricordaChiGuarda\(chi\.dataset\.dmCalpChi\)/);
  /* La riga non compare a chi non ha diviso niente, ne' a chi l'ospite ha gia'
   * riconosciuto: una domanda senza conseguenze e' peggio del silenzio. */
  assert.match(pagina, /if \(!calendariAssegnati\(calendariScritti\(\)\)\) return "";/);
  assert.match(pagina, /if \(utenti\.length < 2\) return "";/);
});

/* L'agenda si riempie quando gli eventi arrivano, non quando si muove la casa.
 *
 * Finche' il guscio ridipingeva tutte e nove le pagine ogni secondo, la pagina
 * dell'agenda si trovava gli eventi addosso senza che nessuno glielo dicesse.
 * Adesso che si disegna solo la pagina che si guarda, chi li ha chiesti deve
 * anche avvisare: aprire l'Agenda mentre gli eventi sono per strada lasciava
 * la settimana vuota fino al primo cambio di stato. */
test("chi chiede gli eventi avvisa la pagina che li aspetta", async () => {
  const home = await readFile(new URL("../src/sections/home-widgets-section.js", import.meta.url), "utf8");
  const pagina = await readFile(new URL("../src/sections/calendario-section.js", import.meta.url), "utf8");
  assert.match(home, /dispatchEvent\?\.\(new CustomEvent\("dashboardmodern:calendario-eventi"\)\)/);
  assert.match(pagina, /"dashboardmodern:calendario-eventi",/);
  /* L'avviso parte solo a lettura riuscita: un errore non fa ridisegnare
   * niente, e la pagina tiene quello che aveva. */
  const dove = home.indexOf('dashboardmodern:calendario-eventi');
  const riuscita = home.lastIndexOf('if (riuscita) {', dove);
  assert.ok(riuscita > 0 && riuscita < dove, "l'avviso sta dentro il ramo della riuscita");
});

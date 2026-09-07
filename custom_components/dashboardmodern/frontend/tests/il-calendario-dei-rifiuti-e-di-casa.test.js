/* «Vorrei che ci fosse la possibilità di un menu a tendina per le 2 settimane
 * così uno sceglie il rifiuto, senza dover creare o modificare il calendario di
 * home assistant.» (#366)
 *
 * Quasi tutti i comuni girano su due settimane, e chi ha quel foglietto sul
 * frigo non ha nessun sensore da collegare: finora la pagina dei rifiuti gli
 * chiedeva di costruirsi un calendario in Home Assistant per scriverci dentro
 * una cosa che sa a memoria.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  GIORNI_DEL_TURNO,
  caselleDelTurno,
  letturaRifiuti,
  normalizzaRifiuti,
  normalizzaTurno,
  rifiutiConfigurati,
  ritiriDalTurno,
  turnoConfigurato,
} from "../src/core/rifiuti-model.js";

/* Lunedì 7 settembre 2026 apre il turno. */
const TURNO = {
  inizio: "2026-09-07",
  giorni: [
    ["organico"], // lun — settimana 1
    ["plastica"],
    [],
    ["carta"],
    [],
    [],
    [],
    ["organico"], // lun — settimana 2
    [],
    ["vetro", "metalli"], // due bidoni lo stesso giorno: capita
    [],
    [],
    [],
    [],
  ],
};
const MERCOLEDI = new Date("2026-09-09T20:00:00").getTime();

test("il turno torna sempre quattordici caselle, comunque sia scritto", () => {
  /* Chi disegna la griglia non deve difendersi da una configurazione storta. */
  assert.equal(normalizzaTurno({ inizio: "2026-09-07", giorni: [["carta"]] }).giorni.length, 14);
  assert.equal(normalizzaTurno(null).giorni.length, GIORNI_DEL_TURNO);
  assert.equal(normalizzaTurno(undefined).inizio, "");
  // Un materiale che non esiste non entra: direbbe il falso vestito da «altro».
  assert.deepEqual(normalizzaTurno({ inizio: "2026-09-07", giorni: [["banane"]] }).giorni[0], []);
  // E lo stesso materiale due volte è una volta.
  assert.deepEqual(
    normalizzaTurno({ inizio: "2026-09-07", giorni: [["carta", "carta"]] }).giorni[0],
    ["carta"],
  );
});

test("senza data d'inizio, o senza materiali, il turno non c'è", () => {
  assert.equal(turnoConfigurato({ giorni: [["carta"]] }), false, "non si può collocare nel tempo");
  assert.equal(turnoConfigurato({ inizio: "2026-09-07", giorni: [] }), false);
  assert.equal(turnoConfigurato(TURNO), true);
});

test("il turno si ripete, anche all'indietro e anche fra anni", () => {
  assert.equal(caselleDelTurno(TURNO, MERCOLEDI), 2, "mercoledì è la terza casella");
  // Quattordici giorni dopo si ricomincia dalla stessa casella.
  assert.equal(caselleDelTurno(TURNO, new Date("2026-09-23T10:00:00")), 2);
  // E un giorno PRIMA dell'inizio non dà una casella negativa.
  assert.equal(caselleDelTurno(TURNO, new Date("2026-09-06T10:00:00")), 13);
  assert.equal(caselleDelTurno(TURNO, new Date("2029-01-17T10:00:00")) >= 0, true);
});

test("ogni materiale esce una volta sola, alla sua prima occasione", () => {
  /* Un elenco che ripete la plastica fra due giorni e fra nove non risponde
   * alla domanda della sera, la annacqua. */
  const ritiri = ritiriDalTurno(TURNO, MERCOLEDI).map((riga) => [riga.materiale, riga.giorni]);
  assert.deepEqual(ritiri, [
    ["carta", 1],
    ["organico", 5],
    ["vetro", 7],
    ["metalli", 7],
    ["plastica", 13],
  ]);
  assert.equal(ritiriDalTurno(TURNO, MERCOLEDI)[0].quando, "domani");
});

test("le righe del turno arrivano come quelle di un sensore", () => {
  /* Chi disegna non deve sapere da dove viene una riga: la pagina, la tessera
   * e il widget mostrano il turno senza una riga di codice in più. */
  const lettura = letturaRifiuti({ turno: TURNO }, {}, (valore) => valore, MERCOLEDI);
  assert.deepEqual(
    lettura.prossimi.map((riga) => riga.materiale),
    ["carta"],
  );
  assert.equal(lettura.prossimi[0].dalTurno, true);
  assert.equal(lettura.prossimi[0].icona, "📦");
  assert.equal(lettura.righe.length, 5);
  assert.equal(lettura.domani.length, 1);
});

test("un materiale che ha già il suo sensore non si ripete", () => {
  /* Il sensore sa la data vera, il turno la data prevista: due righe dello
   * stesso bidone con due date diverse sono peggio di una sola. */
  const config = {
    turno: TURNO,
    righe: [{ id: "r1", materiale: "carta", entity: "sensor.carta" }],
  };
  const stati = { "sensor.carta": { state: "2026-09-12", attributes: {} } };
  const lettura = letturaRifiuti(config, stati, (valore) => valore, MERCOLEDI);
  const carta = lettura.righe.filter((riga) => riga.materiale === "carta");
  assert.equal(carta.length, 1);
  assert.equal(carta[0].entity, "sensor.carta");
  assert.equal(carta[0].giorni, 3, "comanda il sensore, non il turno");
});

test("scritto il turno, i rifiuti sono configurati anche senza entità", () => {
  /* La pagina non deve continuare a chiedere un'entità che non arriverà mai. */
  assert.equal(rifiutiConfigurati({ turno: TURNO }), true);
  assert.equal(rifiutiConfigurati({}), false);
  // E il turno sopravvive alla normalizzazione della configurazione intera.
  assert.equal(normalizzaRifiuti({ turno: TURNO }).turno.giorni[1][0], "plastica");
});

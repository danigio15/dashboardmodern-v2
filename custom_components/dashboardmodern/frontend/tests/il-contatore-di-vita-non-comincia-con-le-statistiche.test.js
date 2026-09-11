/* «Il sensore restituisce 1440,76 kWh per 2026» — e la plancia ne diceva 546.
 *
 * La colonnina è stata installata a marzo 2026, quindi il suo contatore di
 * vita e il consumo dell'anno sono lo stesso numero. Sommare i secchielli del
 * Recorder invece di sottrarre i contatori dei mesi aveva già rimesso a posto
 * un pezzo del conto, ma non questo: il guaio è più in basso, in COSA si
 * somma.
 *
 * La `sum` del Recorder non è la lettura del contatore. È un totale suo, che
 * parte da zero quando cominciano le STATISTICHE di quell'entità — e se quelle
 * cominciano dopo l'apparecchio (un'entità rifatta, un aiutante che filtra i
 * picchi creato mesi dopo, una purga del database) tutto ciò che era stato
 * consumato prima non sta in nessun secchiello. Erano gli 894 kWh che
 * mancavano, e nessuna somma di secchielli poteva ritrovarli.
 *
 * Quando però l'arco contiene tutta la vita REGISTRATA del contatore, anche il
 * suo ultimo azzeramento è caduto lì dentro: quello che segna adesso l'ha
 * consumato dentro l'arco, ed è un pavimento.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { crescitaNellArco, letturaDelContatore } from "../src/core/period-service.js";

const arco = (dal, al, kind = "year") => ({
  kind,
  period: "day",
  start: new Date(dal),
  end: new Date(al),
});

const ANNO = arco("2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");

/* La wallbox di quella segnalazione: installata a marzo, statistiche che
 * cominciano a giugno. Il contatore di vita dice 1440,762; la somma del
 * Recorder, che a giugno è ripartita da zero, arriva a 546. */
const WALLBOX = [
  { start: "2026-06-01T00:00:00Z", sum: 120, state: 1014.9 },
  { start: "2026-07-01T00:00:00Z", sum: 290.4, state: 1185.3 },
  { start: "2026-08-01T00:00:00Z", sum: 430.2, state: 1325.1 },
  { start: "2026-08-31T00:00:00Z", sum: 546, state: 1440.762 },
];

test("l'anno di un contatore di vita è la sua lettura, non la somma del Recorder", () => {
  const anno = crescitaNellArco(WALLBOX, ANNO);
  assert.equal(
    Math.round(anno * 1000) / 1000,
    1440.762,
    "il numero scritto sul contatore, non i 546 dei secchielli",
  );
});

test("quando le statistiche coprono tutta la vita non cambia niente", () => {
  /* Il caso normale: la `sum` del Recorder e la lettura del contatore sono
   * nate insieme, quindi sono lo stesso numero e il massimo non sposta nulla. */
  const righe = [
    { start: "2026-06-01T00:00:00Z", sum: 40, state: 40 },
    { start: "2026-07-01T00:00:00Z", sum: 105, state: 105 },
    { start: "2026-08-01T00:00:00Z", sum: 248.1, state: 248.1 },
  ];
  assert.equal(Math.round(crescitaNellArco(righe, ANNO) * 10) / 10, 248.1);
});

test("un contatore che si azzera ogni mese resta contato per secchielli", () => {
  /* Qui la lettura è solo l'ultimo mese — 46 — mentre i secchielli sanno di
   * tutti i mesi. Prendere la lettura vorrebbe dire buttare via l'anno: il
   * massimo dei due esiste apposta per non farlo. */
  const righe = [
    { start: "2026-06-01T00:00:00Z", sum: 50, state: 50 },
    { start: "2026-07-01T00:00:00Z", sum: 96, state: 46 },
    { start: "2026-08-01T00:00:00Z", sum: 151, state: 55 },
  ];
  assert.equal(crescitaNellArco(righe, ANNO), 151);
});

test("l'arco che continua non prende la lettura del contatore", () => {
  /* Il mese aperto di una colonnina nata a marzo: qui «nessuna riga prima del
   * mio confine» non vuol dire che il contatore sia nato adesso — il pezzo di
   * tempo prima se l'è già preso l'arco davanti. Scrivere lì la lettura di
   * vita vorrebbe dire 1440,762 kWh consumati a settembre. */
  const settembre = arco("2026-09-01T00:00:00Z", "2026-09-11T00:00:00Z", "month");
  const righe = [
    { start: "2026-09-01T00:00:00Z", sum: 546, state: 1440.762 },
    { start: "2026-09-10T00:00:00Z", sum: 614.1, state: 1508.862 },
  ];
  assert.equal(
    Math.round(crescitaNellArco(righe, settembre, { continuazione: true }) * 10) / 10,
    68.1,
  );
});

test("con una riga prima dell'arco la lettura non c'entra", () => {
  /* Il contatore c'era già: la crescita è la differenza, e la sua cumulata di
   * sempre non è il consumo di quest'anno. */
  const righe = [
    { start: "2025-12-01T00:00:00Z", sum: 800, state: 1200 },
    { start: "2026-06-01T00:00:00Z", sum: 900, state: 1300 },
    { start: "2026-08-01T00:00:00Z", sum: 946, state: 1346 },
  ];
  assert.equal(crescitaNellArco(righe, ANNO), 146);
});

test("se il Recorder non manda la lettura si fa come prima", () => {
  /* Una versione di Home Assistant che risponde senza `state`: resta la somma
   * dei secchielli, che è il conto di sempre. */
  const righe = WALLBOX.map(({ start, sum }) => ({ start, sum }));
  assert.equal(crescitaNellArco(righe, ANNO), 546);
});

test("la lettura del contatore si legge da `state`, e solo da lì", () => {
  assert.equal(letturaDelContatore({ state: 1440.762, sum: 546 }), 1440.762);
  assert.equal(letturaDelContatore({ sum: 546 }), null);
  assert.equal(letturaDelContatore(null), null);
});

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

import {
  crescitaNellArco,
  energiaPrimaDelleStatistiche,
  letturaDelContatore,
} from "../src/core/period-service.js";

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

test("il pezzo che manca si sa quanto vale, e si sa che manca", () => {
  /* Al primo secchiello la `sum` del Recorder vale 120 e il contatore ne segna
   * 1014,9: la differenza — 894,9 — è l'energia che il contatore aveva già
   * fatto prima che qualcuno la registrasse. */
  assert.equal(Math.round(energiaPrimaDelleStatistiche(WALLBOX, ANNO) * 10) / 10, 894.9);
});

test("quel pezzo NON si aggiunge al totale, perché non si sa quando è stato fatto", () => {
  /* È la tentazione da cui guardarsi. Su una colonnina installata quest'anno
   * quegli 894 kWh sono tutti di quest'anno; su un contatore vecchio a cui
   * hanno rifatto l'entità — un'entità rinominata, un aiutante creato mesi
   * dopo, un database ripulito — sono di anni fa, e scriverli nell'anno lo
   * gonfierebbe di tutta la vita dell'apparecchio. Fra le due il Recorder non
   * dà modo di scegliere, e sbagliare in quel verso è molto peggio che restare
   * corti: il totale resta quello dei secchielli, e l'ammanco si dice. */
  assert.equal(crescitaNellArco(WALLBOX, ANNO), 546);
});

test("un contatore le cui statistiche sono nate con lui non ha ammanchi", () => {
  const righe = [
    { start: "2026-06-01T00:00:00Z", sum: 0, state: 0 },
    { start: "2026-07-01T00:00:00Z", sum: 105, state: 105 },
    { start: "2026-08-01T00:00:00Z", sum: 248.1, state: 248.1 },
  ];
  assert.equal(energiaPrimaDelleStatistiche(righe, ANNO), 0);
  assert.equal(Math.round(crescitaNellArco(righe, ANNO) * 10) / 10, 248.1);
});

test("con una riga prima dell'arco l'ammanco non riguarda questo totale", () => {
  /* Le statistiche cominciano prima del periodo guardato: qualunque pezzo
   * manchi, manca a un periodo che non è questo. */
  const righe = [
    { start: "2025-12-01T00:00:00Z", sum: 800, state: 1200 },
    { start: "2026-06-01T00:00:00Z", sum: 900, state: 1300 },
  ];
  assert.equal(energiaPrimaDelleStatistiche(righe, ANNO), 0);
});

test("senza `state` non si inventa un ammanco", () => {
  assert.equal(
    energiaPrimaDelleStatistiche(
      WALLBOX.map(({ start, sum }) => ({ start, sum })),
      ANNO,
    ),
    0,
  );
});

test("un contatore che si azzera ogni mese resta contato per secchielli", () => {
  const righe = [
    { start: "2026-06-01T00:00:00Z", sum: 50, state: 50 },
    { start: "2026-07-01T00:00:00Z", sum: 96, state: 46 },
    { start: "2026-08-01T00:00:00Z", sum: 151, state: 55 },
  ];
  assert.equal(crescitaNellArco(righe, ANNO), 151);
});

test("l'arco che continua conta la differenza, non la cumulata", () => {
  const settembre = arco("2026-09-01T00:00:00Z", "2026-09-11T00:00:00Z", "month");
  const righe = [
    { start: "2026-09-01T00:00:00Z", sum: 546, state: 1440.762 },
    { start: "2026-09-10T00:00:00Z", sum: 614.1, state: 1508.862 },
  ];
  assert.equal(
    Math.round(crescitaNellArco(righe, settembre, { continuazione: true }) * 10) / 10,
    68.1,
  );
  /* La funzione risponde anche qui — di suo non sa che questo arco continua un
   * altro — ma chi la chiama gliela chiede solo sul PRIMO arco del periodo,
   * così l'ammanco non finisce due volte sulla stessa card. */
  assert.equal(energiaPrimaDelleStatistiche(righe, settembre), 894.762);
});

test("con una riga prima dell'arco si sottrae, come sempre", () => {
  const righe = [
    { start: "2025-12-01T00:00:00Z", sum: 800, state: 1200 },
    { start: "2026-06-01T00:00:00Z", sum: 900, state: 1300 },
    { start: "2026-08-01T00:00:00Z", sum: 946, state: 1346 },
  ];
  assert.equal(crescitaNellArco(righe, ANNO), 146);
});

test("se il Recorder non manda la lettura si fa come prima", () => {
  const righe = WALLBOX.map(({ start, sum }) => ({ start, sum }));
  assert.equal(crescitaNellArco(righe, ANNO), 546);
});

test("la lettura del contatore si legge da `state`, e solo da lì", () => {
  assert.equal(letturaDelContatore({ state: 1440.762, sum: 546 }), 1440.762);
  assert.equal(letturaDelContatore({ sum: 546 }), null);
  assert.equal(letturaDelContatore(null), null);
});

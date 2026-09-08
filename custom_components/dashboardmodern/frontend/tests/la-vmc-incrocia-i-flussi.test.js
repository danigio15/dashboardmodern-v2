/* «Nella riga in basso dovresti invertire la freccia in modo che l'aria da casa
 * vada verso fuori casa o ancora meglio invertire e mettere fuori a sx e da
 * casa a dx lasciando la freccia così e rispettando la logica della macchina
 * che incrocia i flussi.» (#401)
 *
 * Le due righe mettevano tutte e due l'origine a sinistra: «Da fuori → In
 * casa» sopra, «Da casa ← Fuori» sotto. La seconda si contraddiceva da sola —
 * la freccia puntava verso la parola «Da casa», cioè diceva che l'aria entrava
 * mentre le etichette dicevano che usciva.
 *
 * Le colonne adesso sono fisse — fuori a sinistra, casa a destra — e l'unica
 * cosa che cambia fra le due righe è la freccia. È anche l'unica cosa che le
 * distingue davvero, e incolonnate così si incrociano: come fa lo scambiatore.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(new URL("../src/sections/vmc-section.js", import.meta.url), "utf8");

/* Il pezzo che disegna un braccio del flusso, isolato dal resto. */
const flusso = sorgente.slice(
  sorgente.indexOf("function flussoMarkup"),
  sorgente.indexOf("function flussoMarkup") + 1600,
);

test("la freccia non punta mai contro la sua etichetta", () => {
  /* La riga in uscita non deve più leggersi «Da casa ← Fuori»: era la
   * contraddizione segnalata. */
  assert.doesNotMatch(flusso, /Da casa", "From the house"\)\)\}<\/small>[\s\S]{0,400}\? "→" : "←"/);
});

test("fuori sta a sinistra e casa a destra in tutte e due le righe", () => {
  /* Il capo di sinistra dice sempre fuori... */
  assert.match(flusso, /entra \? t\("Da fuori", "From outside"\) : t\("Fuori", "Outside"\)/);
  /* ...e quello di destra dice sempre casa. */
  assert.match(
    flusso,
    /entra \? t\("In casa", "Into the house"\) : t\("Da casa", "From the house"\)/,
  );
});

test("i due capi prendono la temperatura giusta, non quella di prima", () => {
  /* Incolonnare vuol dire scambiare: il capo di sinistra è il «prima» della
   * riga che entra e il «dopo» di quella che esce. Senza questo i gradi
   * resterebbero attaccati alle etichette sbagliate — che sarebbe peggio della
   * freccia storta, perché una freccia si legge e un numero si crede. */
  assert.match(flusso, /const sinistra = entra \? prima : dopo;/);
  assert.match(flusso, /const destra = entra \? dopo : prima;/);
});

test("le due frecce restano opposte: è l'unica cosa che distingue le righe", () => {
  assert.match(flusso, /\$\{entra \? "→" : "←"\}/);
});

/* «Per qualche motivo quando c'è anche l'allerta della finestra aperta le altre
 * schede non sono allineate» (#424, dopo la correzione della 1.4.17).
 *
 * La colonna era sparita — quella era la segnalazione di partenza — ma ne è
 * rimasta un'altra sotto: una finestra aperta si porta dietro la sua fascia
 * d'allerta, quindi quella scheda è più alta delle altre. Con `align-items:
 * start` ogni scheda teneva la sua altezza naturale e si appoggiava in cima
 * alla riga: bordi di sopra allineati, bordi di sotto a scaletta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SORGENTE = readFileSync(
  new URL("../src/sections/shutter-section.js", import.meta.url),
  "utf8",
);

const REGOLA = (ago) => {
  const inizio = SORGENTE.indexOf(ago);
  assert.ok(inizio > 0, `la regola ${ago} esiste`);
  return SORGENTE.slice(inizio, SORGENTE.indexOf("}", inizio) + 1);
};

test("le schede di una riga prendono tutte la stessa altezza", () => {
  const griglia = REGOLA("#tapp-grid{display:grid");
  assert.match(griglia, /align-items:stretch!important/);
  assert.doesNotMatch(griglia, /align-items:start/);
});

test("ma dentro la scheda il contenuto resta in cima", () => {
  /* Il vuoto in più va in fondo, dove non lo nota nessuno, invece di spingere
   * la finestra disegnata in mezzo alla scheda. */
  const scheda = REGOLA(".tapp-card{box-sizing");
  assert.match(scheda, /height:100%!important/);
  assert.match(scheda, /align-content:start!important/);
});

test("la griglia che toglie la colonna resta quella", () => {
  /* La correzione della 1.4.17 non era sbagliata: risolveva un'altra cosa, e
   * si tiene. */
  const griglia = REGOLA("#tapp-grid{display:grid");
  /* Il minimo ha un tetto: su uno schermo dove una colonna da 288 non ci
   * sta, `auto-fit` la faceva lo stesso e la card sbordava a destra, con
   * l'interruttore fuori dallo schermo (#483). `min(288px,100%)` tiene il
   * minimo dov'era e gli impedisce di superare il posto che c'è: sopra la
   * soglia non cambia un pixel. */
  assert.match(griglia, /repeat\(auto-fit,minmax\(min\(288px,100%\),1fr\)\)/);
});

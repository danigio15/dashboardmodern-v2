/* «Problema sempre presente sia su schermo 27 pollici che da iphone» (#479).
 *
 * La correzione precedente aveva rimpicciolito la PAGINA, e la pagina non
 * c'entrava: il guaio erano i tre tasti del programma, e ce l'avevano addosso.
 *
 * Erano in `flex-wrap` con «parti da 146 e cresci per riempire la riga». Su una
 * riga sola la crescita si ferma al tetto e avanza un vuoto in coda; quando
 * invece i tre vanno a capo due più uno — ed è quello che succede su un
 * telefono — il terzo resta DA SOLO su una riga da riempire e cresce fino al
 * tetto, mentre i due sopra stanno alla misura minima. Un tasto largo il doppio
 * degli altri, sotto di loro.
 *
 * È una proprietà di `flex-grow`, non un caso: l'ultima riga di un flex che va
 * a capo si spartisce tutto lo spazio fra i pochi che ci sono rimasti.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SORGENTE = readFileSync(
  new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url),
  "utf8",
);

const REGOLA = (selettore) => {
  const inizio = SORGENTE.indexOf(`${selettore}{`);
  assert.ok(inizio > 0, `la regola ${selettore} esiste`);
  return SORGENTE.slice(inizio, SORGENTE.indexOf("}", inizio) + 1).replace(/\s+/g, " ");
};

test("i tasti del programma non crescono più per riempire la riga", () => {
  const riga = REGOLA(".dm-irr-actions");
  assert.match(riga, /display:grid/);
  assert.doesNotMatch(riga, /flex-wrap/);
  const tasto = REGOLA(".dm-irr-actions>.dm-btn");
  assert.doesNotMatch(tasto, /flex:/, "niente flex-grow: era lui a gonfiare l'ultimo");
  assert.match(tasto, /width:100%/, "il tasto riempie la sua colonna, e la colonna è uguale");
});

test("le colonne hanno un minimo leggibile e un tetto", () => {
  /* Il minimo tiene i tasti leggibili sul telefono; il tetto è la lezione della
   * versione ancora prima, quella a colonne uguali senza limite, che su un
   * ventisette faceva «tre tasti da mezzo metro». */
  const riga = REGOLA(".dm-irr-actions");
  assert.match(riga, /repeat\(auto-fit,minmax\(146px,220px\)\)/);
  assert.match(riga, /justify-content:start/);
});

test("sul telefono le colonne si stringono, ma restano colonne", () => {
  const stretto = SORGENTE.slice(SORGENTE.indexOf("@media"));
  assert.match(
    stretto,
    /\.dm-irr-actions\{grid-template-columns:repeat\(auto-fit,minmax\(112px,1fr\)\)\}/,
  );
  assert.doesNotMatch(stretto, /\.dm-irr-actions>\.dm-btn\{flex-basis/);
});

test("la pagina resta della misura della piscina", () => {
  /* La correzione di prima non era sbagliata, era solo un'altra cosa: la si
   * tiene. */
  assert.match(SORGENTE, /#page-irrigazione \.dm-irr\{[\s\S]{0,200}max-width:1040px!important/);
});

/* Quello che una finestra mostra ci deve stare dentro.
 *
 * «Tutti i popup e sezioni e card, qualsiasi cosa, deve avere adattamento
 * schermo: non puo' essere tagliata.» Con la fotografia: il dettaglio della
 * lavastoviglie, sul telefono, con i nomi dei comandi e i loro menu che
 * finiscono oltre il bordo destro e spariscono.
 *
 * Sparire e' la parola giusta: `.modal-card` del guscio ha `overflow-x:hidden`,
 * e quella scelta e' sensata — una finestra che scorre di lato e' peggio del
 * problema che risolve — ma vuol dire che quello che non ci sta non si vede e
 * non si raggiunge in nessun modo.
 *
 * La causa non era nelle righe: era la LISTA. Una griglia senza colonne
 * dichiarate ne fa una implicita `auto`, e una traccia `auto` cresce fino al
 * contenuto piu' largo invece di fermarsi al contenitore. Misurato in Chromium
 * col foglio di stile vero, a 430 px: la lista veniva 403 px dentro uno spazio
 * da 384, e venti elementi finivano oltre il bordo; a 320 px ne restavano
 * fuori 114. Con una colonna `minmax(0,1fr)` la traccia si stringe, e a 320,
 * 360, 390 e 430 px la lista e' larga esattamente quanto lo spazio che ha.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sorgente = readFileSync(
  new URL("../src/sections/appliance-detail-popup-section.js", import.meta.url),
  "utf8",
);

test("la lista del dettaglio dichiara una colonna che si puo' stringere", () => {
  assert.match(
    sorgente,
    /#details-list\[data-dm-apde-owner="moduli"\]\{\s*\n\s*display:grid;grid-template-columns:minmax\(0,1fr\);gap:0\}/,
  );
});

test("una riga di comando va a capo invece di schiacciare il comando", () => {
  /* Su uno schermo stretto il menu si stringerebbe fino a non poterlo usare:
   * meglio due piani. E il comando ha una base sua, non una percentuale. */
  assert.match(sorgente, /\.dm-apde-comando\{\s*\n\s*display:flex;flex-wrap:wrap;/);
  assert.match(sorgente, /\.dm-apde-menu,#details-list \.dm-apde-numero\{\s*\n\s*flex:1 1 140px;min-width:0;max-width:220px/);
});

test("il guscio taglia, e per questo la larghezza la deve rispettare chi disegna", () => {
  /* Se un giorno `.modal-card` smettesse di tagliare, questa riga lo dice: la
   * regola qui sopra nasce da quel vincolo, e senza di lui andrebbe ripensata
   * invece di restare li' per inerzia. */
  const guscio = readFileSync(new URL("../legacy/dashboard-runtime-it.css", import.meta.url), "utf8");
  assert.match(guscio, /\.modal-card \{[^}]*overflow-x: hidden/);
});

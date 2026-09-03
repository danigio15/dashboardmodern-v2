/* «Resta sempre la barra totale, per poi diventare come l'ho configurata: dura
 * quattro o cinque secondi.»
 *
 * Misurato sulla plancia vera, dall'avvio: a 648 ms la barra si dipinge con
 * tutte e nove le voci del guscio e `cd_sections` non esiste ancora; a 675 ms
 * il guscio ne scrive una sua — ricavata da quali sezioni hanno contenuto, e in
 * quel momento non ne ha nessuna — e a 783 ms la barra diventa due voci; a 846
 * ms il magazzino proietta la configurazione vera; a 1431 ms arrivano le voci
 * dei moduli, non filtrate; a 1505 ms si assesta. Quattro forme, e tre erano
 * false.
 *
 * La decisione che questo modulo prende e' una sola, e si prova qui: la
 * configurazione della casa e' arrivata, oppure no? Il resto — coprire,
 * scoprire, filtrare una voce appena aggiunta — e' documento, e lo prova un
 * browser.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { laConfigurazioneSiConosce } from "../src/sections/navigation-section.js";

const magazzino = (stato) => ({ getState: () => stato });

test("senza magazzino non si sa niente, e la barra aspetta", () => {
  assert.equal(laConfigurazioneSiConosce(undefined), false);
  assert.equal(laConfigurazioneSiConosce(null), false);
  assert.equal(laConfigurazioneSiConosce({}), false);
  assert.equal(laConfigurazioneSiConosce(magazzino(null)), false);
});

test("un magazzino appena nato non e' una configurazione", () => {
  /* Nasce cosi', ed e' il caso che faceva scoprire la barra su un'ipotesi:
   * `visibility: {}` risponde «tutto visibile» esattamente come una casa che
   * non ha configurato niente. */
  assert.equal(
    laConfigurazioneSiConosce(magazzino({ schema_version: 4, sections: {}, visibility: {} })),
    false,
  );
});

test("basta una preferenza di visibilita'", () => {
  assert.equal(
    laConfigurazioneSiConosce(magazzino({ sections: {}, visibility: { energy: false } })),
    true,
  );
});

test("o una sezione configurata, anche senza preferenze", () => {
  /* Una casa che ha delle stanze ma non ha mai toccato la visibilita' e' una
   * casa configurata: la barra di serie e' la risposta giusta, e si puo'
   * mostrare subito perche' non c'e' niente che la smentira'. */
  assert.equal(
    laConfigurazioneSiConosce(magazzino({ sections: { rooms: [] }, visibility: {} })),
    true,
  );
});

test("un magazzino che si arrabbia non blocca la barra per sempre", () => {
  /* Torna «non lo so», e chi chiama ha la sua scadenza: meglio la barra di
   * serie che nessuna barra. */
  const rotto = {
    getState() {
      throw new Error("il magazzino non risponde");
    },
  };
  assert.equal(laConfigurazioneSiConosce(rotto), false);
});

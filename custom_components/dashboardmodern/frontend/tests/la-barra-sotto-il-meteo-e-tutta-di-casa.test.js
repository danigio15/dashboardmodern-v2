/* «Icone barra sotto al menu non sono del nostro catalogo: se non esistono
 *  creale, e ovviamente vanno cambiate ovunque.»
 *
 * La barra sotto il meteo il disegno lo chiedeva gia': `facciaDellaPastiglia`
 * prova prima il catalogo di casa e solo dopo ripiega sull'emoji. Il guaio e'
 * che per quattro delle sue quattordici voci il catalogo non aveva niente —
 * la posta, l'umidita', la pioggia di adesso e quella di oggi — e quelle
 * quattro cadevano sempre nel ripiego: l'emoji del sistema, in fila accanto a
 * dieci oggetti disegnati.
 *
 * E l'elenco nella configurazione le emoji ce le aveva TUTTE, scritte a mano
 * riga per riga: la stessa barra con due facce diverse a seconda di dove la
 * si guardava.
 *
 * Adesso il catalogo le ha tutte e quattro, e l'elenco della scheda chiede il
 * disegno allo stesso catalogo da cui lo chiedono le pastiglie. Questa prova
 * tiene le due cose insieme: nessuna voce senza oggetto, e nessun posto che se
 * lo disegni per conto suo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { VOCI_DELLA_BARRA } from "../src/core/come-sta-la-casa.js";
import { haOggettoWidget, oggettoWidget } from "../src/core/oggetti-widget.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("ogni voce della barra ha il suo oggetto nel catalogo", () => {
  const senza = VOCI_DELLA_BARRA.map((voce) => voce.chiave).filter(
    (chiave) => !haOggettoWidget(chiave),
  );
  assert.deepEqual(senza, [], `voci senza disegno di casa: ${senza.join(", ")}`);
});

test("i quattro che mancavano sono disegni, non simboli", () => {
  for (const chiave of ["posta", "umidita", "pioggia", "pioggiaOggi"]) {
    const disegno = oggettoWidget(chiave);
    assert.match(disegno, /^<svg class="dm-oggetto"/, `${chiave} deve essere un disegno`);
    /* Ognuno e' il SUO oggetto: quattro copie dello stesso non sarebbero
     * quattro pastiglie distinguibili. */
    assert.notEqual(disegno, oggettoWidget("temperatura"));
  }
  /* La pioggia di adesso e quella di oggi sono due domande diverse — quanta ne
   * viene giu' ora, quanta ne e' caduta da stamattina — e portano due oggetti
   * diversi. */
  assert.notEqual(oggettoWidget("pioggia"), oggettoWidget("pioggiaOggi"));
});

test("l'elenco della scheda chiede il disegno, non si scrive un'emoji", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  assert.match(
    sorgente,
    /<span class="dm-casa-ed-ic" aria-hidden="true">\$\{oggettoWidget\(voce\.chiave\)\}<\/span>/,
  );
  /* E la tabella dei nomi e' tornata a fare i nomi: niente piu' coppie
   * [emoji, nome], che erano il posto da cui usciva la seconda faccia. */
  assert.match(sorgente, /const NOMI_DELLE_VOCI = \(\) => \(\{\s*\n\s*posta: t\("Posta", "Mail"\),/);
  const tabella = sorgente.slice(
    sorgente.indexOf("const NOMI_DELLE_VOCI"),
    sorgente.indexOf("/* Una casella per un sensore della barra"),
  );
  assert.ok(
    !/\[\s*"[^"]*\p{Extended_Pictographic}/u.test(tabella),
    "nessuna emoji scritta a mano nell'elenco della barra",
  );
});

test("il disegno nella scheda ha la sua misura, o esce grande quanto il foglio", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sorgente, /#ed-body \.dm-casa-ed-ic \.dm-oggetto\{width:24px;height:24px/);
});

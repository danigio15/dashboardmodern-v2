/* «Verifica inoltre perché esce sotto room etc.»
 *
 * Sotto «Tapparella salone» c'era scritto «🏠 room_mt8vpz7m». La tendina delle
 * stanze salva l'ID — ed è giusto: è l'unica cosa che regge un rinominamento —
 * ma gli elenchi che stampa il guscio vendorizzato scrivono quello che
 * trovano, e da quando la tendina salva l'id, quello che trovano è l'id.
 *
 * E c'è la metà che non si vede: il piano di una stanza il guscio lo cerca per
 * nome, e con un id in mano tornava «nessun piano» — le tapparelle di una casa
 * a due piani finivano tutte sotto lo stesso gruppo.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("un identificativo di stanza diventa il suo nome, dovunque si legga", async () => {
  const { testoConINomi } = await import("../src/sections/stanze-per-nome-section.js");
  const nomi = { room_mt8vpz7m: "Soggiorno", room_mt8vrer0: "Cucina" };
  const nome = (id) => nomi[id] || id;

  assert.equal(testoConINomi("🏠 room_mt8vpz7m", nome), "🏠 Soggiorno");
  assert.equal(
    testoConINomi("🏢 Piano terra · 🏠 room_mt8vrer0", nome),
    "🏢 Piano terra · 🏠 Cucina",
  );
  /* Più d'uno nella stessa riga, e ognuno il suo. */
  assert.equal(testoConINomi("room_mt8vpz7m e room_mt8vrer0", nome), "Soggiorno e Cucina");
  /* Una stanza cancellata non ha più un nome: l'id resta, che è brutto ma
   * vero — inventarle un nome sarebbe peggio. */
  assert.equal(testoConINomi("🏠 room_sparita", nome), "🏠 room_sparita");
  /* E quello che non è un identificativo non si tocca. */
  assert.equal(testoConINomi("Soggiorno", nome), "Soggiorno");
  assert.equal(testoConINomi("la stanza room_ è vuota", nome), "la stanza room_ è vuota");
  assert.equal(testoConINomi("", nome), "");
});

test("si guarda solo dove un id può uscire, e solo se ce n'è uno", () => {
  const sorgente = leggi("sections/stanze-per-nome-section.js");
  /* Una scansione di stringa sola prima della passeggiata: nel caso normale —
   * che è «non ce n'è nessuno» — si esce subito, invece di camminare su ogni
   * nodo di testo della pagina a ogni disegno. */
  assert.match(
    sorgente,
    /if \(!radice \|\| !String\(radice\.textContent \|\| ""\)\.includes\("room_"\)\) return 0;/,
  );
  /* La scheda aperta e la pagina che si sta guardando: non tutto il documento. */
  assert.match(sorgente, /doc\.getElementById\("ed-body"\)/);
  assert.match(sorgente, /doc\.querySelectorAll\("\.page\.active"\)/);
  /* Prima si legge tutto, poi si scrive: cambiare dentro la passeggiata vuol
   * dire camminare su un albero che si muove. */
  assert.match(sorgente, /const daCambiare = \[\];/);
});

test("il piano si trova anche partendo dall'identificativo", () => {
  const sorgente = leggi("sections/stanze-per-nome-section.js");
  /* Il guscio cerca per nome; se non trova, si richiede col nome della stanza
   * — e le tapparelle di due piani tornano in due gruppi. */
  assert.match(sorgente, /function cdRoomFloorOf\(riferimento\)/);
  assert.match(sorgente, /const nome = clean\(roomLabel\(riferimento\)\);/);
  assert.match(sorgente, /originale\.call\(this, nome\)/);
});

test("nella scheda Finestre la stanza sta in alto, e dice di essere la stanza", () => {
  const sorgente = leggi("sections/shutter-window-section.js");
  /* «La stanza la devi spostare in alto dove si sceglie il nome e devi
   * indicare che è la stanza»: il guscio la stampa come un select nudo, e con
   * le sei caselle aggiunte in mezzo finiva undici campi più giù. */
  assert.match(sorgente, /function vestiLaStanza\(body\)/);
  assert.match(sorgente, /testa\.textContent = t\("Stanza", "Room"\);/);
  assert.match(sorgente, /if \(nome\.nextElementSibling !== riquadro\) nome\.after\(riquadro\);/);
  /* E si rimette in fila a ogni giro, o il guscio la rimanderebbe in fondo
   * ristampando il modulo. */
  assert.match(
    sorgente,
    /vestiLaStanza\(body\);\n\s*const ancora = ancoraSottoLaPrincipale\(body\);/,
  );
});

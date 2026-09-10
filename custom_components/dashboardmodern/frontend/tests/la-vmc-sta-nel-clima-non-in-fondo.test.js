/* «Ma perché ventilazione meccanica è inserito nella sezione sicurezza? E
 * dentro minipc.»
 *
 * Perché le sezioni del Config non sono linguette separate: stanno tutte nello
 * STESSO corpo, una sotto l'altra a fisarmonica. La scheda della VMC si
 * appendeva in fondo al corpo — e il fondo del corpo, per chi ha aperto la
 * Sicurezza o il MiniPC, è sotto la Sicurezza o sotto il MiniPC. Non era finita
 * nella sezione sbagliata: era finita in fondo a tutto, che da dove si guarda è
 * la stessa cosa.
 *
 * L'ancora è il tasto che aggiunge un'unità del Clima: è lo stesso appiglio che
 * usa il blocco del Clima rapido, che infatti non è mai scappato.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("la scheda si appende accanto al tasto del Clima, non in fondo al corpo", async () => {
  const fonte = await leggi("../src/sections/vmc-editor-section.js");
  assert.match(fonte, /function tastoAggiungiClima\(\)/);
  assert.match(fonte, /querySelector\?\.\('\[onclick\*="edAddClima"\]'\)/);
  assert.match(fonte, /aggiungi\.before\(scheda\)/);
  /* E non finisce piu' in coda al corpo: era quella riga a farla comparire
   * sotto qualunque sezione fosse aperta. */
  assert.doesNotMatch(fonte, /body\.append\(scheda\)/);
});

test("senza l'ancora la scheda se ne va, invece di restare orfana", async () => {
  const fonte = await leggi("../src/sections/vmc-editor-section.js");
  /* Il campo dell'entita' dice che il Clima c'e', ma non dice DOVE: nel corpo
   * c'e' sempre, anche mentre si guarda un'altra sezione. Serve l'ancora. */
  assert.match(fonte, /Boolean\(body\?\.querySelector\?\.\("#ed-cl-ent"\)\) && Boolean\(tastoAggiungiClima\(\)\)/);
  assert.match(fonte, /if \(!aggiungi\) \{\s*\n\s*scheda\?\.remove\(\);/);
  /* E se il guscio ridisegna il Clima, la scheda si rimette al suo posto
   * invece di restare dove il ridisegno l'ha lasciata. */
  assert.match(fonte, /scheda\.nextElementSibling !== aggiungi/);
});

test("il Clima rapido si aggancia allo stesso appiglio, ed è il motivo per cui non scappava", async () => {
  const rapido = await leggi("../src/sections/quick-climate-editor-section.js");
  assert.match(rapido, /querySelector\?\.\('\[onclick\*="edAddClima"\]'\)/);
  assert.match(rapido, /aggiungi\.before\(blocco\)/);
});

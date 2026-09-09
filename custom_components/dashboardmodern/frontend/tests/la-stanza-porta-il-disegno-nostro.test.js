/* Nella sezione Elettrodomestici le stanze portano il disegno di casa.
 *
 * «Nelle stanze degli elettrodomestici ci sono icone che non sono del nostro
 * catalogo. Non so quante volte l'ho detto: non voglio vedere icone che non
 * sono nostre.»
 *
 * Due posti chiedevano `iconGlyph`, che di un nome mdi torna l'EMOJI — quella
 * del telefono, diversa su ogni apparecchio e diversa da tutto il resto della
 * plancia: la colonna delle stanze e le linguette del filtro. Il disegno lo da'
 * `iconGlyphMarkup`, ed e' lo stesso che disegna le tessere.
 *
 * Resta un'emoji sola, nella tendina delle stanze della scheda: dentro un
 * `<option>` il browser disegna testo e basta, e finche' e' un `<select>` non
 * c'e' niente da fare. Questa prova la lascia passare per nome, cosi' se
 * domani ne rispunta un'altra si vede.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ROOM_CATALOG, roomCatalogMatch } from "../src/core/personalization-catalog.js";
import { chiaviDaProvare, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";
import { canonicalArtworkType } from "../src/core/appliance-artwork.js";

const SEZIONI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections");
const leggi = (nome) => readFileSync(join(SEZIONI, nome), "utf8");

/* La sola eccezione, e il perche' sta scritto nel modulo. */
const DENTRO_UNA_TENDINA = new Set(["appliance-editor-section.js"]);

test("gli elettrodomestici non chiedono mai l'emoji al posto del disegno", () => {
  const colpevoli = [];
  for (const nome of [
    "appliance-showcase-section.js",
    "appliances-section.js",
    "appliance-editor-section.js",
    "appliance-integration-section.js",
  ]) {
    const codice = leggi(nome).replaceAll(/\/\*[\s\S]*?\*\//g, "");
    if (/\biconGlyph\s*\(/.test(codice) && !DENTRO_UNA_TENDINA.has(nome)) colpevoli.push(nome);
  }
  assert.deepEqual(colpevoli, [], `chiedono l'emoji invece del disegno: ${colpevoli.join(", ")}`);
});

test("la colonna delle stanze disegna, e «senza stanza» pure", () => {
  const codice = leggi("appliance-showcase-section.js");
  assert.match(codice, /iconGlyphMarkup\("room"/, "la stanza deve portare il suo disegno");
  assert.doesNotMatch(
    codice.replaceAll(/\/\*[\s\S]*?\*\//g, ""),
    /icon:\s*"[^"a-z]/u,
    "nessuna voce della colonna porta un'emoji scritta a mano",
  );
});

test("ogni stanza del catalogo un disegno ce l'ha davvero", () => {
  /* Se una non ce l'avesse, il motore ripiegherebbe sull'emoji e la colonna
   * tornerebbe mista: e' la condizione che rende vera la correzione. */
  const senza = ROOM_CATALOG.filter(
    (stanza) =>
      !chiaviDaProvare("room", stanza.mdi, roomCatalogMatch(stanza.mdi)).some(
        (chiave) => canonicalArtworkType(chiave) || disegnoDelCatalogo(chiave, 20),
      ),
  ).map((stanza) => `${stanza.id} (${stanza.mdi})`);
  assert.deepEqual(senza, [], `stanze che ripiegherebbero sull'emoji: ${senza.join(", ")}`);
});

/* «Riordinare a piacere la Home: persone, widget, azioni rapide.»
 *
 * Le tessere si riordinavano già da un pezzo, con le frecce nella scheda
 * Widget. Le altre due no: una persona stava dov'era nata, e per spostare
 * un'azione rapida di un posto bisognava cancellarla e rifarla in fondo —
 * cioè perdere la sua icona, il suo nome e la sua conferma per un gesto che
 * non c'entrava niente con loro.
 *
 * E una persona si può spegnere invece di cancellarla: chi va via un mese non
 * deve rifare la sua card al ritorno.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { normalizePeople } from "../src/core/person-model.js";
import { spostaNellElenco } from "../src/core/ordine-a-mano.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const sorgente = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

test("una persona spenta resta configurata", () => {
  const [anna, bruno] = normalizePeople([
    { name: "Anna", entity: "person.anna", nascosta: true },
    { name: "Bruno", entity: "person.bruno" },
  ]);
  assert.equal(anna.nascosta, true);
  assert.equal(anna.name, "Anna");
  assert.equal(bruno.nascosta, false);
  /* Il campo sopravvive a un secondo giro: e' il difetto per cui mezza dozzina
   * di campi sono spariti prima di lui. */
  assert.equal(normalizePeople([anna])[0].nascosta, true);
});

test("la Home mostra le persone accese, la scheda tutte", () => {
  const persone = sorgente("src/sections/people-section.js");
  assert.match(persone, /export function peopleInHome\(\)/);
  assert.match(persone, /\.filter\(\(person\) => person\?\.nascosta !== true\)/);
  /* Il disegno, il popup, la freccia del popup e l'orologio guardano l'elenco
   * acceso: una card che non c'e' non si apre e non fa battere niente. */
  assert.match(persone, /const people = peopleInHome\(\);\n {2}if \(!people\.length\)/);
  assert.doesNotMatch(
    persone,
    /const wanted = homeVisible\(\)[^\n]*configuredPeople\(\)\.length/,
  );
});

test("le frecce e l'interruttore stanno nella riga della persona", () => {
  const editor = sorgente("src/sections/people-editor-section.js");
  assert.match(editor, /data-person-up/);
  assert.match(editor, /data-person-down/);
  assert.match(editor, /data-person-shown/);
  /* Prima di ridisegnare si mette al sicuro quello che c'e' scritto: il
   * ridisegno riscrive le caselle con quello che c'e' in memoria. */
  assert.match(editor, /const attuali = raccogliRighe\(body, people\);\n\s+const prossime = spostaNellElenco/);
  /* La riga aperta segue la riga, non il posto. */
  assert.match(editor, /if \(state\.aperto === index\) state\.aperto = index \+ passo;/);
});

test("le azioni rapide si spostano, e la fila è quella che si vede", () => {
  const crud = sorgente("src/sections/editor-crud-section.js");
  assert.match(crud, /const SI_RIORDINANO = new Set\(\["action"\]\)/);
  assert.match(crud, /data-dm-move-kind/);
  assert.match(crud, /writeJsonIfChanged\("cd_quick_actions", prossima\)/);
  /* Le stanze e il clima si guardano per nome: le frecce li' sarebbero un
   * gesto senza effetto. */
  assert.doesNotMatch(crud, /SI_RIORDINANO = new Set\(\[[^\]]*"room"/);
});

test("spostare è lo stesso gesto ovunque", () => {
  /* Tre elenchi, una funzione: l'ultimo elemento è il posto dove si sbaglia,
   * e sbagliarlo una volta sola è già abbastanza. */
  assert.deepEqual(spostaNellElenco(["anna", "bruno", "carla"], 2, -1), [
    "anna",
    "carla",
    "bruno",
  ]);
  for (const percorso of [
    "src/sections/people-editor-section.js",
    "src/sections/editor-crud-section.js",
  ])
    assert.match(sorgente(percorso), /import \{ spostaNellElenco \} from "\.\.\/core\/ordine-a-mano\.js"/);
});

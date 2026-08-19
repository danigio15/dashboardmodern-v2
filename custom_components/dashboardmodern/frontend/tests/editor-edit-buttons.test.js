import assert from "node:assert/strict";
import test from "node:test";

import { editButtonPlan } from "../src/sections/editor-crud-section.js";

/* Il numero di una riga e' la sua posizione nell'elenco.
 *
 * Chi dipinge le righe legge quel numero per sapere quale unita' mostrare: due
 * righe con lo stesso numero mostrano la stessa unita', ed e' cosi' che la
 * stessa entita' finiva su tutte le righe.
 */
test("una lista mai toccata prende i numeri in ordine", () => {
  const plan = editButtonPlan([{}, {}, {}]);
  assert.deepEqual(plan, [
    { index: 0, action: "create" },
    { index: 1, action: "create" },
    { index: 2, action: "create" },
  ]);
});

test("una passata che trova le prime righe gia' fatte non fa ripartire i numeri da zero", () => {
  // E' cio' che accade quando il runtime ridisegna solo una parte dell'elenco:
  // le righe in alto hanno gia' il pulsante, quelle in coda no.
  const plan = editButtonPlan([
    { hasButton: true, index: 0 },
    { hasButton: true, index: 1 },
    {},
    {},
  ]);
  assert.deepEqual(plan.map((step) => step.index), [0, 1, 2, 3]);
  assert.deepEqual(plan.map((step) => step.action), ["keep", "keep", "create", "create"]);
});

test("una riga che porta il numero sbagliato viene corretta, non lasciata com'e'", () => {
  // Dopo un'eliminazione le righe scalano: la terza diventa la seconda e il
  // numero che si porta dietro punterebbe all'unita' di prima.
  const plan = editButtonPlan([
    { hasButton: true, index: 1 },
    { hasButton: true, index: 2 },
    { hasButton: true, index: 3 },
  ]);
  assert.deepEqual(plan.map((step) => step.index), [0, 1, 2]);
  assert.deepEqual(plan.map((step) => step.action), ["renumber", "renumber", "renumber"]);
});

test("in nessun caso due righe portano lo stesso numero", () => {
  const shapes = [
    [{ hasButton: true, index: 0 }, {}, { hasButton: true, index: 0 }, {}],
    [{}, { hasButton: true, index: 0 }, { hasButton: true, index: 0 }],
    [{ hasButton: true, index: 5 }, { hasButton: true, index: 5 }],
  ];
  for (const rows of shapes) {
    const indices = editButtonPlan(rows).map((step) => step.index);
    assert.equal(new Set(indices).size, indices.length, JSON.stringify(rows));
    assert.deepEqual(indices, rows.map((_row, index) => index));
  }
});

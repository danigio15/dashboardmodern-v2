/* «Quando vado a inserire il grid import mi modifica anche l'export.»
 *
 * Segnalato da chi usa due sensori separati — niente sorgente unica con segno —
 * e ripetuto per la batteria. Il motivo: rete e batteria si configurano in due
 * riquadri, uno per verso, e la potenza compariva in tutti e due. Ma il
 * modello ne ha una sola — `grid.power` e' la potenza scambiata con la rete,
 * col segno a dire da che parte va — quindi le due caselle erano la stessa
 * casella disegnata due volte: si scriveva il sensore sotto «Rete · prelievo»
 * e lo si vedeva comparire sotto «Rete · immissione».
 *
 * Con la sorgente unica non si vedeva, perche' li' quella casella e' spenta:
 * ed e' esattamente quello che la segnalazione diceva.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { renderEnergyEditor } from "../src/core/renderers.js";
import { creaDocumentoFinto } from "./helpers/fake-document.js";

function disegna(model = {}) {
  const { document, root } = creaDocumentoFinto();
  renderEnergyEditor(document, root, model, [], {}, "it", {});
  return root;
}

const inputConNome = (root) =>
  root.queryAll((nodo) => nodo.tagName === "INPUT" && typeof nodo.name === "string" && nodo.name);

function caselle(root, nome) {
  return inputConNome(root).filter((nodo) => nodo.name === nome);
}

test("la potenza della rete si scrive in una casella sola", () => {
  const root = disegna();
  assert.equal(caselle(root, "grid.power").length, 1, "due caselle per lo stesso campo");
});

test("e cosi' quella della batteria", () => {
  const root = disegna();
  assert.equal(caselle(root, "battery.power").length, 1);
});

test("nessun campo del modello ha piu' di una casella", () => {
  const root = disegna();
  const conteggi = new Map();
  for (const input of inputConNome(root)) {
    const nome = input.name;
    if (!nome.includes(".") || nome.includes(".signed.")) continue;
    conteggi.set(nome, (conteggi.get(nome) || 0) + 1);
  }
  const doppioni = [...conteggi].filter(([, quante]) => quante > 1);
  assert.deepEqual(doppioni, [], "un campo del modello, una casella");
});

test("il riquadro che non la stampa dice dove trovarla", () => {
  const root = disegna();
  const rimandi = root.queryAll((nodo) => Boolean(nodo.dataset?.energyElsewhere));
  const chiavi = rimandi.map((nodo) => nodo.dataset.energyElsewhere);
  assert.ok(chiavi.includes("grid.power"), "la rete non dice dov'e' la potenza");
  assert.ok(chiavi.includes("battery.power"), "la batteria non dice dov'e' la potenza");
  for (const rimando of rimandi) {
    assert.match(rimando.textContent, /si imposta in/, "il rimando non dice dove");
  }
});

test("le caselle dei due versi restano due, e distinte", () => {
  const root = disegna();
  // Il difetto era la potenza condivisa: prelievo e immissione hanno campi
  // diversi e devono continuare ad avere caselle diverse.
  assert.equal(caselle(root, "grid.daily_import_energy").length, 1);
  assert.equal(caselle(root, "grid.daily_export_energy").length, 1);
  assert.equal(caselle(root, "battery.daily_charged_energy").length, 1);
  assert.equal(caselle(root, "battery.daily_discharged_energy").length, 1);
});

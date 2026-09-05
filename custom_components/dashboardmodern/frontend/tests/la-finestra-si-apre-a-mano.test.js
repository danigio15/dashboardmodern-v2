/* Una finestra che non si comanda.
 *
 * «Io non ho le tapparelle, ho le persiane e sono manuali, pero' ho sensori di
 * apertura, volevo inserirli ma chiede obbligatoriamente l'entita' tapparella».
 *
 * Il modulo offriva la casella del contatto e poi rifiutava di salvare la riga
 * che conteneva solo quello: una promessa e un dietrofront. Una riga cosi' non
 * comanda niente, ma sa dire se la finestra e' aperta — ed e' esattamente cio'
 * che la card sa gia' disegnare.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { coverEntries } from "../src/core/cover-kind.js";
import { contactEntity, isWindowOnly } from "../src/core/shutter-window.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

test("il solo contatto fa una finestra, e non una copertura", () => {
  const persiana = { name: "Camera", contact: "binary_sensor.finestra_camera" };
  assert.equal(isWindowOnly(persiana), true);
  assert.equal(contactEntity(persiana), "binary_sensor.finestra_camera");
  // Non comanda niente: di coperture non ne ha nemmeno una.
  assert.deepEqual(coverEntries(persiana), []);
});

test("con una copertura vera la riga torna una copertura", () => {
  for (const riga of [
    { entity: "cover.tapparella", contact: "binary_sensor.f" },
    { tenda: "cover.tenda", contact: "binary_sensor.f" },
    { tendaSole: "cover.sole", contact: "binary_sensor.f" },
  ])
    assert.equal(isWindowOnly(riga), false);
});

test("una riga senza niente non e' una finestra", () => {
  assert.equal(isWindowOnly({}), false);
  assert.equal(isWindowOnly({ name: "Camera" }), false);
  assert.equal(isWindowOnly(), false);
});

test("i nomi che il contatto puo' avere valgono tutti", () => {
  for (const chiave of ["contact", "contact_entity", "window_entity", "opening_entity"])
    assert.equal(isWindowOnly({ [chiave]: "binary_sensor.f" }), true, chiave);
});

test("il salvataggio accetta la riga col solo sensore", async () => {
  const crud = await leggi("../src/sections/editor-crud-section.js");
  /* Il rifiuto del runtime si zittiva solo davanti a una copertura vera. Un
   * contatto e' l'altra cosa che rende la riga sensata. */
  assert.match(crud, /const eUnContatto = \(valore\) =>/);
  assert.match(crud, /binary_sensor\|sensor\|input_boolean/);
  assert.match(crud, /eUnContatto\(extra\.contact\) \|\|\s*eUnContatto\(extra\.inferriata\)/);
  /* L'inferriata conta quanto l'infisso.
   *
   * Il contatto della grata e' arrivato dopo (#254) e in questo elenco non era
   * mai entrato: chi ha le persiane manuali e il sensore sulla grata riempiva
   * la sola casella che aveva e si prendeva «Inserisci una entita' cover
   * valida». Sono due contatti della stessa finestra, e uno vale l'altro. */
  assert.match(crud, /eUnaCopertura\(extra\.tendaSole\) \|\|/);
});

test("la card della finestra sola non promette comandi che non arrivano", async () => {
  const scena = await leggi("../src/sections/shutter-scene-section.js");
  assert.match(scena, /function windowOnlyCardMarkup/);
  const card = scena.match(/function windowOnlyCardMarkup[\s\S]*?\n\}/)[0];
  /* Niente Apri/Ferma/Chiudi su una persiana che si muove a mano, e niente
   * cursore: direbbe una posizione che nessuno misura. */
  assert.doesNotMatch(card, /cdTappCmd|data-svc|data-dm-position|dm-tapp-bar/);
  // La pastiglia resta: e' l'unica cosa che quella riga ha da dire.
  assert.match(card, /data-dm-state/);
  assert.match(scena, /if \(view\.soloInfisso\) return windowOnlyCardMarkup\(view\);/);
});

test("una finestra a mano non si conta fra le tapparelle aperte", async () => {
  const scena = await leggi("../src/sections/shutter-scene-section.js");
  const conto = scena.match(/function summaryText[\s\S]*?\n\}/)[0];
  // Contarla fra le aperte direbbe che c'e' una tapparella su, e non c'e'.
  assert.match(conto, /\.filter\(\(view\) => !view\.soloInfisso\)/);
  assert.match(conto, /1 finestra aperta/);
});

test("la card ritrova la sua riga dal contatto, che e' l'unica entita' che ha", async () => {
  const finestra = await leggi("../src/sections/shutter-window-section.js");
  assert.match(finestra, /clean\(contactEntity\(item\)\) === entity/);
});

test("la scheda dice che il solo sensore basta", async () => {
  const finestra = await leggi("../src/sections/shutter-window-section.js");
  assert.match(finestra, /lascia vuote le caselle dei comandi e compila solo il sensore di apertura/);
});

/* La posizione preferita di una tapparella (#200).
 *
 * «Non voglio la chiusura completa ma tipo al 95%, per lasciar passare un po'
 * d'aria»: la riga di configurazione porta un numero 0-100 nella scala del
 * cursore, la card mostra il quarto tasto accanto ad Apri/Ferma/Chiudi, il
 * popup della Home lo stesso — e tutti passano da `set_cover_position`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { coverPositionChoices, coverPresetPosition } from "../src/core/cover-kind.js";
import { normalizeDevice } from "../src/core/device-model.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("il preset e' un numero 0-100, e il vuoto non e' zero", () => {
  assert.equal(coverPresetPosition({ preset: 5 }), 5);
  assert.equal(coverPresetPosition({ preset: "95" }), 95);
  assert.equal(coverPresetPosition({ preset: 0 }), 0);
  assert.equal(coverPresetPosition({ preset: "0" }), 0);
  // Fuori scala si rientra, non si rifiuta: 120 e' «aperta».
  assert.equal(coverPresetPosition({ preset: 120 }), 100);
  assert.equal(coverPresetPosition({ preset: -3 }), 0);
  // Vuoto, mancante o non numerico: nessun preset, mai 0.
  assert.equal(coverPresetPosition({ preset: "" }), null);
  assert.equal(coverPresetPosition({}), null);
  assert.equal(coverPresetPosition({ preset: "boh" }), null);
  assert.equal(coverPresetPosition({ preset_position: 40 }), 40);
});

test("il preset sopravvive alla normalizzazione, come contatto e tipo prima di lui", () => {
  const normalizzata = normalizeDevice(
    { id: "cover-1", name: "Camera", entity: "cover.camera", preset: "5" },
    "covers",
    { rooms: [] },
  );
  assert.equal(normalizzata.preset, 5);
  const senza = normalizeDevice(
    { id: "cover-2", name: "Salotto", entity: "cover.salotto", preset: "" },
    "covers",
    { rooms: [] },
  );
  assert.equal("preset" in senza, false);
});

test("le percentuali della tendina scendono di cinque in cinque, e la preferita sta al suo posto", () => {
  const scelte = coverPositionChoices(null);
  assert.equal(scelte[0], 100);
  assert.equal(scelte.at(-1), 0);
  assert.equal(scelte.length, 21);
  assert.ok(scelte.includes(95), "il 95% dell'esempio c'e'");
  // La preferita fuori scala entra in ordine, non in coda.
  const conPreferita = coverPositionChoices(3);
  assert.ok(conPreferita.includes(3));
  assert.equal(conPreferita.indexOf(3), conPreferita.indexOf(5) + 1);
  assert.deepEqual(
    [...conPreferita].sort((a, b) => b - a),
    conPreferita,
    "restano in scala, dall'aperta alla chiusa",
  );
  // Una preferita che cade su un passo non si sdoppia.
  assert.equal(coverPositionChoices(95).filter((value) => value === 95).length, 1);
});

test("la card offre la tendina a chi accetta una posizione, non un tasto fisso", () => {
  const scena = leggi("sections/shutter-scene-section.js");
  assert.match(scena, /function presetSelectMarkup/);
  assert.match(scena, /<select data-dm-preset/);
  assert.match(scena, /coverPositionChoices\(preferita\)/);
  // Niente piu' tasto con la percentuale scritta dentro.
  assert.doesNotMatch(scena, /function presetButtonMarkup/);
  // La tendina non chiede piu' una preferita: basta che qualcuno accetti la
  // posizione. La preferita, se c'e', porta la stella.
  assert.match(scena, /if \(!tutte\.some\(\(cover\) => cover\.settable\)\) return ""/);
  assert.match(scena, /value === preferita \? "⭐ "/);
  // La scelta riusa il percorso del cursore: grab, anteprima e servizio, e
  // poi la tendina torna alla voce d'invito.
  assert.match(scena, /function applyPreset/);
  assert.match(scena, /previewPosition\(range\);\s*\n\s*commitPosition\(range\);/);
  assert.match(scena, /select\.value = "";/);
  // La forma della card cambia con la preferita: la firma lo deve sapere.
  assert.match(scena, /c\.settable, c\.kind, c\.preset/);
});

test("il popup della Home offre la stessa tendina, solo a chi puo' usarla", () => {
  const popup = leggi("sections/shutter-section.js");
  assert.match(popup, /coverPresetPosition\(cover\)/);
  assert.match(popup, /function presetOptionsMarkup/);
  assert.match(popup, /createElement\("select"\)/);
  assert.match(popup, /comando\.hidden = !item\.settable/);
  assert.match(popup, /set_cover_position/);
  // Le voci si riscrivono solo quando cambia la preferita: altrimenti la
  // tendina si richiuderebbe sotto il dito a ogni aggiornamento.
  assert.match(popup, /dataset\.shutterOptions !== firma/);
});

test("tutti e tre gli editor conoscono la casella del preset", () => {
  // Il modale moderno.
  const modale = leggi("sections/unified-editors-section.js");
  assert.match(modale, /name="preset"/);
  assert.match(modale, /coverPresetPosition\(\{ preset: form\.elements\.preset\?\.value \}\)/);
  // Il modulo legacy, tramite la casella iniettata.
  const infisso = leggi("sections/shutter-window-section.js");
  assert.match(infisso, /id="ed-tp-preset"/);
  // La matita sulle righe salvate e la voce appena aggiunta.
  const crud = leggi("sections/editor-crud-section.js");
  assert.match(crud, /setField\("ed-tp-preset"/);
  assert.match(crud, /getElementById\("ed-tp-preset"\)/);
});

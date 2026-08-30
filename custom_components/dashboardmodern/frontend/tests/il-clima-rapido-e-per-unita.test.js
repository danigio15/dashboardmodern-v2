/* Il tasto Clima rapido e' per unita', e le tendine non restano mai vuote.
 *
 * Dal campo, nello stesso giro: «come e' impostato ora viene attribuito quel
 * valore a tutto» — il blocco globale sopra le unita' non permetteva alla
 * cameretta di volere 24 gradi col salone a 26; la tendina della Ventola
 * offriva solo «Non toccare» quando l'unita' non dichiarava i suoi
 * `fan_modes`; la tessera della stanza nel popup Clima mostrava una PORTA
 * appena l'unita' aveva una stanza; e quattro azioni rapide «Azione rapida ·
 * clima» non si distinguevano in niente.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  QUICK_CLIMATE_FAN_FALLBACK,
  quickClimateForUnit,
  quickClimateSteps,
} from "../src/core/quick-climate.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, "..");
const leggi = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

test("ogni unita' ha i suoi passi, e il globale resta il ripiego", () => {
  const perUnita = {
    "climate.cameretta": { mode: "cool", temperature: 24, fan: "low" },
  };
  const globale = { mode: "cool", temperature: 26, fan: "auto" };

  const cameretta = quickClimateForUnit("climate.cameretta", perUnita, globale);
  assert.equal(cameretta.temperature, 24);
  assert.equal(cameretta.fan, "low");

  const salone = quickClimateForUnit("climate.salone", perUnita, globale);
  assert.equal(salone.temperature, 26);
  assert.equal(salone.fan, "auto");

  /* E i passi che ne escono sono quelli della sua scelta. */
  const passi = quickClimateSteps(cameretta);
  assert.deepEqual(passi[1], { service: "set_temperature", data: { temperature: 24 } });
  assert.deepEqual(passi[2], { service: "set_fan_mode", data: { fan_mode: "low" } });
});

test("le quattro velocita' standard sono il ripiego della ventola", () => {
  assert.deepEqual([...QUICK_CLIMATE_FAN_FALLBACK], ["auto", "low", "medium", "high"]);
  const editor = leggi("src/sections/quick-climate-editor-section.js");
  assert.match(
    editor,
    /ventole\.size \? \[\.\.\.ventole\] : \[\.\.\.QUICK_CLIMATE_FAN_FALLBACK\]/,
    "quando nessuna unita' dichiara i fan_modes si offrono le velocita' standard",
  );
});

test("i gusci chiedono i passi dell'entita' toccata, non quelli globali", () => {
  for (const guscio of ["legacy/dashboard-runtime-it.js", "legacy/dashboard-runtime-en.js"]) {
    assert.match(
      leggi(guscio),
      /window\.dmQuickClimateSteps\(entityId\)/,
      `${guscio}: nsToggleClima deve passare la sua entita'`,
    );
  }
});

test("il blocco del tasto rapido vive nel form dell'unita', non sopra a tutto", () => {
  const editor = leggi("src/sections/quick-climate-editor-section.js");
  assert.match(
    editor,
    /edAddClima/,
    "l'aggiunta di un'unita' salva i passi per QUELLA unita'",
  );
  assert.match(editor, /aggiungi\.before\(blocco\)/, "il blocco sta prima di Aggiungi unita' clima");
  const modale = leggi("src/sections/unified-editors-section.js");
  assert.match(
    modale,
    /salvaQuickClimateDaCampi\(form, list\[index\]\.entity\)/,
    "la matita dell'unita' salva anche i suoi passi",
  );
});

test("la tessera del popup Clima disegna la stanza, non una porta", () => {
  const testo = leggi("src/sections/climate-thermal-section.js");
  assert.doesNotMatch(testo, /clean\(unita\.room\) \? "🚪"/, "la porta non e' l'icona di una stanza");
  assert.match(
    testo,
    /disegnoDellaStanza\(unita\.room\)/,
    "l'icona della tessera viene dal catalogo dei disegni della stanza",
  );
});

test("un popup nativo senza nome dice cosa apre, e non chiede entita'", () => {
  const beta16 = leggi("src/sections/beta16-real-device-layout-section.js");
  assert.match(
    beta16,
    /titoli\[type\] \|\| \(t\("Azione rapida", "Quick action"\)\)/,
    "la riga di un builtin senza nome porta il titolo del popup",
  );
  const slots = leggi("src/sections/editor-slots-section.js");
  assert.match(
    slots,
    /\["toggle", "script", "scene"\]\.includes\(tipo\)/,
    "il campo entita' delle azioni compare solo per i tipi che lo usano",
  );
});

test("le tendine delle stanze dei modali dicono solo il nome", () => {
  const modale = leggi("src/sections/unified-editors-section.js");
  assert.doesNotMatch(
    modale,
    /room\.icon \|\| "🏠"/,
    "niente emoji davanti al nome nelle option dei modali",
  );
});

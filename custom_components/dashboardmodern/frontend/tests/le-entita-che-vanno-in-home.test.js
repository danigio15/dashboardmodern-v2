/* Quali entita' finiscono nei widget della Home.
 *
 * Le tessere leggono la configurazione della sezione che raccontano, tutta.
 * Chi non vuole tutto lo dice accanto all'entita' stessa, negli editor: un
 * interruttore per riga, e la scelta viaggia in `cd_widgets.excluded`
 * insieme all'ordine delle tessere. Chi non e' nell'elenco e' dentro, cosi'
 * chi non tocca niente vede quello che vedeva prima.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("l'interruttore nasce sulla riga dove l'entita' e' gia' scritta", () => {
  const scelta = leggi("sections/widget-entity-choice-section.js");
  // Il gancio e' `.ed-row-old`: e' li' che ogni editor del runtime scrive
  // l'entity_id in chiaro, comunque disegni il resto della riga.
  assert.match(scelta, /\.ed-row-old/);
  assert.match(scelta, /querySelectorAll\("\.ed-row"\)/);
  // Dentro il blocco del nome, non accanto: le righe sono griglie con le loro
  // colonne, e un figlio in piu' le manderebbe a capo. E in testa, non in
  // coda: l'interruttore galleggia a destra e il nome gli scorre accanto —
  // messo dopo il testo scenderebbe sotto, e ogni riga dell'editor crescerebbe
  // di una riga intera, che su un telefono e' la differenza fra un elenco e
  // una torre.
  assert.match(scelta, /testo\.prepend\(button\)/);
  assert.match(scelta, /float:right/);
  assert.match(scelta, /querySelector\("\.ed-row-main"\)/);
  // Chi non mostra un entity_id non riceve niente: non c'e' niente da
  // escludere.
  assert.match(scelta, /if \(!entities\.length\) continue/);
  // Si rimette a ogni ridisegno della scheda, come le altre decorazioni.
  assert.match(scelta, /onEditorRedraw\(/);
  assert.match(scelta, /"dashboardmodern:editor-rendered"/);
});

test("la scelta abita in cd_widgets, accanto all'ordine delle tessere", () => {
  const scelta = leggi("sections/widget-entity-choice-section.js");
  assert.match(scelta, /WIDGETS_CONFIG_KEY/);
  assert.match(scelta, /excluded: \[\.\.\.insieme\]\.sort\(\)/);
  // Salvare ridisegna il ponte: la Home cambia sotto gli occhi.
  assert.match(scelta, /renderHomeWidgets\(\)/);
});

test("ogni tessera rispetta le esclusioni, e chi non sceglie vede tutto", async () => {
  const { widgetIncludes } = await import("../src/sections/home-widgets-section.js");
  const fuori = new Set(["light.cucina"]);
  assert.equal(widgetIncludes("light.cucina", fuori), false);
  assert.equal(widgetIncludes("light.salotto", fuori), true);
  // Senza entita' non si esclude niente: una riga senza entity_id resta.
  assert.equal(widgetIncludes("", fuori), true);
  assert.equal(widgetIncludes(null, fuori), true);

  const ponte = leggi("sections/home-widgets-section.js");
  // Le liste, le luci, il clima, le tapparelle, le telecamere, le stanze, gli
  // elettrodomestici, le porte e i gruppi sorvegliati: tutti filtrano.
  assert.equal((ponte.match(/widgetIncludes\(/g) || []).length >= 10, true);
  assert.match(ponte, /function widgetExcludedEntities/);
  // I gruppi del Quadro filtrano alla fonte, cosi' il conteggio e l'elenco
  // restano d'accordo fra loro.
  assert.match(ponte, /lista\.map\(clean\)\.filter\(\(entity\) => entity && widgetIncludes/);
});

test("il runtime installa la scelta", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installWidgetEntityChoiceSection\(\)/);
  assert.match(runtime, /"widget-entity-choice"/);
});

/* La % di umidita' del terreno nella sezione Irrigazione.
 *
 * «Potresti mettere la possibilita' di vedere la % di umidita' del terreno
 * mediante l'opportuna entita'»: il sensore sta nella configurazione
 * dell'irrigazione (`soilEnt`), la card del programma mostra il misuratore —
 * lo stesso disegno di pH e cloro — e le soglie facoltative disegnano la
 * banda ideale.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { soilMoisture } from "../src/sections/pool-irrigation-scene-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const source = readFileSync(join(SRC, "sections/pool-irrigation-scene-section.js"), "utf8");

test("la lettura e' una percentuale 0-100, e l'assenza non e' zero", () => {
  const previous = globalThis.STATES;
  try {
    globalThis.STATES = {
      "sensor.terreno": { state: "42.4", attributes: {} },
      "sensor.fradicio": { state: "130", attributes: {} },
      "sensor.rotto": { state: "unavailable", attributes: {} },
    };
    assert.deepEqual(soilMoisture({ soilEnt: "sensor.terreno" }), {
      entity: "sensor.terreno",
      reading: 42.4,
    });
    // Fuori scala si rientra: un sensore che dice 130 e' terreno fradicio, non un errore.
    assert.equal(soilMoisture({ soilEnt: "sensor.fradicio" }).reading, 100);
    // Un sensore muto e' «nessuna lettura», mai 0%.
    assert.equal(soilMoisture({ soilEnt: "sensor.rotto" }).reading, null);
    assert.equal(soilMoisture({ soil_entity: "sensor.terreno" }).reading, 42.4);
    assert.deepEqual(soilMoisture({}), { entity: "", reading: null });
  } finally {
    if (previous === undefined) delete globalThis.STATES;
    else globalThis.STATES = previous;
  }
});

test("il misuratore sta nella card del programma e si aggiorna senza ridisegnare", () => {
  // Il markup nasce con la firma; i valori passano da syncGauge a ogni giro.
  assert.match(source, /function soilGaugeMarkup/);
  assert.match(source, /\[data-dm-gauge="soil"\]/);
  assert.match(source, /syncGauge\(\s*host\.querySelector\('\[data-dm-gauge="soil"\]'\)/);
  // La firma sa quando il sensore comincia a rispondere, o il misuratore
  // resterebbe fuori per sempre su una plancia accesa prima degli stati.
  assert.match(source, /soil:\$\{soil\.entity\}:\$\{soil\.reading != null\}/);
});

test("le caselle stanno nella scheda Irrigazione e il salvataggio le conserva", () => {
  assert.match(source, /id="ed-irr-soil"/);
  assert.match(source, /id="ed-irr-soil-min"/);
  assert.match(source, /id="ed-irr-soil-max"/);
  /* Il salvataggio del runtime riscrive cd_irrigazione senza sapere di questi
   * campi: l'aggancio a edIrrSaveCfg li rimette al loro posto, leggendoli
   * PRIMA: il salvataggio del runtime finisce con
   * `editorSwitch('irr')`, che rifa' la scheda da capo. Un aggancio che corre
   * solo dopo leggerebbe caselle appena disegnate col valore vecchio, e la
   * modifica scritta a mano sparirebbe in silenzio. */
  assert.match(source, /const raccolto = leggiSoil\(\);\s*\n\s*const esito = originale\.apply/);
  assert.match(source, /salvaSoil\(raccolto\);/);
  assert.match(source, /salvataggio\.__dmIrrSoilSave = true;/);
  assert.doesNotMatch(source, /wrapFunction\("edIrrSaveCfg"/);
  // Vuoto vuol dire «niente sensore», mai zero.
  assert.match(source, /delete next\.soilEnt/);
});

/* La tessera «In evidenza» (#236): le entita' scelte a mano, in Home.
 *
 * Il quadro elettrico, la sonda del rack, la pompa del pozzo: cose che una
 * sezione non ce l'hanno e che prima in Home non avevano un posto. La
 * configurazione sta in `cd_evidenza` — righe {name, icon?, entity, room_id?}
 * scritte nella scheda 🧩 Widget — e il modello le aggrega in una tessera
 * sola: il numero grande dice quante sono, la didascalia le nomina col loro
 * valore, le righe portano glifo, nome e stato formattato con l'unita'.
 * Senza nemmeno un'entita' configurata la tessera non esiste.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* Il modulo tocca il documento e il magazzino del browser: qui se ne mette in
 * piedi giusto quanto basta a farlo girare, prima di caricarlo. */
const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { evidenzaModel } = await import("../src/sections/home-widgets-section.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

function scrivi(chiave, valore) {
  magazzino.set(chiave, JSON.stringify(valore));
}

const STATI = {
  "sensor.quadro_temp": {
    entity_id: "sensor.quadro_temp",
    state: "34.2",
    attributes: { friendly_name: "Quadro", unit_of_measurement: "°C" },
  },
  "sensor.rack_temp": {
    entity_id: "sensor.rack_temp",
    state: "41.8",
    attributes: { friendly_name: "Rack", unit_of_measurement: "°C" },
  },
  "switch.pompa_pozzo": {
    entity_id: "switch.pompa_pozzo",
    state: "on",
    attributes: { friendly_name: "Pompa pozzo" },
  },
};

test("senza configurazione la tessera non esiste", () => {
  magazzino.clear();
  assert.equal(evidenzaModel(STATI), null);
  scrivi("cd_evidenza", []);
  assert.equal(evidenzaModel(STATI), null);
  // Nemmeno con righe senza entita': una riga a meta' non fa tessera.
  scrivi("cd_evidenza", [{ name: "Vuota", entity: "" }]);
  assert.equal(evidenzaModel(STATI), null);
});

test("il modello aggrega: numero, riassunto e righe formattate", () => {
  magazzino.clear();
  scrivi("cd_evidenza", [
    { name: "quadro", entity: "sensor.quadro_temp" },
    { name: "rack", entity: "sensor.rack_temp" },
    { name: "pompa", icon: "🚰", entity: "switch.pompa_pozzo", room_id: "garage" },
  ]);
  const modello = evidenzaModel(STATI);
  assert.equal(modello.key, "evidenza");
  assert.equal(modello.icon, "⭐");
  assert.equal(modello.value, "3");
  // La didascalia e' il riassunto: «quadro 34,2 °C · rack 41,8 °C · pompa Acceso».
  assert.match(modello.caption, /quadro 34[.,]2 °C · rack 41[.,]8 °C · pompa/);
  // Le righe portano glifo, nome e valore con l'unita'.
  assert.equal(modello.rows.length, 3);
  assert.equal(modello.rows[0].glyph, "⭐");
  assert.equal(modello.rows[0].name, "quadro");
  assert.match(modello.rows[0].value, /34[.,]2 °C/);
  // Il glifo scelto per riga vince sulla stella.
  assert.equal(modello.rows[2].glyph, "🚰");
  // La pompa e' un acceso/spento: parola per gli occhi, `on` per i conti.
  assert.equal(modello.rows[2].on, true);
  // Con qualcosa di acceso la tessera si accende.
  assert.equal(modello.attiva, true);
});

test("l'interruttore «nel widget» vale anche per le evidenze", () => {
  magazzino.clear();
  scrivi("cd_evidenza", [
    { name: "quadro", entity: "sensor.quadro_temp" },
    { name: "rack", entity: "sensor.rack_temp" },
  ]);
  scrivi("cd_widgets", { excluded: ["sensor.rack_temp"] });
  const modello = evidenzaModel(STATI);
  assert.equal(modello.rows.length, 1);
  assert.equal(modello.rows[0].name, "quadro");
});

test("un'entita' che non risponde resta in tessera col trattino", () => {
  magazzino.clear();
  scrivi("cd_evidenza", [{ name: "sonda persa", entity: "sensor.sparita" }]);
  const modello = evidenzaModel(STATI);
  assert.equal(modello.rows.length, 1);
  assert.equal(modello.rows[0].value, "—");
  assert.equal(modello.attiva, false);
});

test("la tessera e' iscritta al popup a caselle e al catalogo dell'editor", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const editor = leggi("sections/todo-editor-section.js");
  // Il popup la rende a caselle: la chiave sta in CHIAVI_A_CARTE.
  const carte = ponte.slice(ponte.indexOf("const CHIAVI_A_CARTE"), ponte.indexOf("]);", ponte.indexOf("const CHIAVI_A_CARTE")));
  assert.match(carte, /"evidenza"/);
  // Il catalogo ordina/accendi ha la sua riga con la stella.
  assert.match(editor, /\["evidenza", "⭐", t\("In evidenza", "Highlights"\)\]/);
  // E la scheda Widget ha il blocco di configurazione che scrive cd_evidenza.
  assert.match(editor, /EVIDENZA_CONFIG_KEY/);
  assert.match(editor, /data-evid-add/);
  assert.match(editor, /data-evid-del/);
  assert.match(editor, /wzPickEntity/);
});

/* Due impianti, e i carichi dell'uno che non cancellano quelli dell'altro
 * (#292, dal campo); le tessere Energia che si comportano tutte da tessere
 * (#286, dal campo).
 *
 *   «Configurando un carico su uno dei due impianti dopo il salvataggio
 *    cancella quelli sull'altro.» «Passando da un impianto all'altro in
 *    configurazione non aggiorna i carichi.» «Solo il primo widget segue
 *    l'ordinamento, l'altro resta in coda; il secondo non ha il tasto per
 *    andare nella sezione; il tasto del primo apre l'impianto che era attivo.»
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { loadsConfigToSections } = await import("../src/core/energy-loads-config.js");
const { applyWidgetPreferences } = await import("../src/sections/home-widgets-section.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const primo = {
  id: "carico-1",
  plant: "",
  name: "Cucina Giovanni",
  power_entity: "sensor.cucina_g",
  control_entity: "switch.cucina_g",
  metadata: { flow_group: "carico-1" },
};

test("salvare i carichi del secondo impianto non tocca quelli del primo, anche con gli stessi id", () => {
  const modelloDonato = [{ id: "carico-1", name: "Cucina Donato", power: "sensor.cucina_d", children: [] }];
  const { loads } = loadsConfigToSections(modelloDonato, [primo], "donato");
  const giovanni = loads.find((load) => load.name === "Cucina Giovanni");
  const donato = loads.find((load) => load.name === "Cucina Donato");
  assert.ok(giovanni, "il carico dell'altro impianto sopravvive");
  assert.equal(giovanni.id, "carico-1");
  assert.equal(giovanni.plant, "");
  assert.ok(donato);
  assert.equal(donato.plant, "donato");
  /* L'id che l'altro impianto usa gia' si rinomina, cosi' nessuna riga ne
   * copre un'altra. */
  assert.equal(donato.id, "donato-carico-1");
  assert.equal(donato.metadata.flow_group, "donato-carico-1");
  /* E i campi tenuti non si prendono dall'impianto sbagliato. */
  assert.equal(donato.control_entity ?? "", "");
  assert.equal(donato.power_entity, "sensor.cucina_d");
});

test("salvare il primo impianto lascia al suo posto tutto quello del secondo", () => {
  const donato = { id: "donato-carico-1", plant: "donato", name: "Cucina Donato", power_entity: "sensor.cucina_d" };
  const figlio = { id: "lavatrice-d", plant: "donato", name: "Lavatrice", metadata: { beta27_subload_group: "donato-carico-1" } };
  const modelloGiovanni = [{ id: "carico-1", name: "Cucina Giovanni", power: "sensor.cucina_g", children: [] }];
  const { loads } = loadsConfigToSections(modelloGiovanni, [primo, donato, figlio], "");
  assert.deepEqual(
    loads.map((load) => [load.id, load.plant]).sort(),
    [
      ["carico-1", ""],
      ["donato-carico-1", "donato"],
      ["lavatrice-d", "donato"],
    ],
  );
  /* Con un impianto solo — nessun impianto passato — tutto come sempre. */
  const solo = loadsConfigToSections(modelloGiovanni, [primo], null);
  assert.deepEqual(solo.loads.map((load) => load.id), ["carico-1"]);
});

test("la scheda Carichi si rilegge quando si cambia impianto", () => {
  const editor = leggi("sections/energy-loads-editor-section.js");
  /* Il modello in mano si mette da parte se sporco, altrimenti si butta, e la
   * scheda si ridisegna con quello dell'impianto nuovo (o con la sua bozza). */
  assert.match(
    editor,
    /addEventListener\?\.\("dashboardmodern:energy-plant-changed", \(\) => \{[\s\S]*?state\.model = bozza;\s*state\.dirty = Boolean\(bozza\);\s*state\.impianto = adesso;\s*scheduleRender\(\);/,
  );
});

test("tutte le tessere energia seguono l'ordine di «Energia», e ognuna porta alla sua sezione", () => {
  magazzino.set("cd_widgets", JSON.stringify({ order: ["luci", "energia", "clima"] }));
  const ordinate = applyWidgetPreferences([
    { key: "clima" },
    { key: "energia_donato" },
    { key: "energia" },
    { key: "luci" },
  ]);
  assert.deepEqual(
    ordinate.map((w) => w.key),
    ["luci", "energia_donato", "energia", "clima"],
  );
  magazzino.delete("cd_widgets");
  const home = leggi("sections/home-widgets-section.js");
  assert.match(home, /SEZIONE_DEL_WIDGET\[eUnaTesseraEnergia\(chiave\) \? "energia" : clean\(chiave\)\]/);
  assert.match(home, /impianto: clean\(impianto\?\.id\) \|\| PRIMO_IMPIANTO,/);
  assert.match(home, /data-dm-w-impianto="\$\{esc\(widget\.impianto\)\}"/);
  assert.match(home, /new CustomEvent\("dashboardmodern:energy-plant-requested", \{ detail: \{ plant: impianto \} \}\)/);
  const impianti = leggi("sections/energy-plants-section.js");
  assert.match(impianti, /addEventListener\?\.\("dashboardmodern:energy-plant-requested"/);
  assert.match(impianti, /ascoltaLaHome\(\);/);
});

test("il modello di un impianto non prende i figli dell'altro, nemmeno con lo stesso id di cerchio (revisione)", async () => {
  /* Due maschere numerano i cerchi allo stesso modo, e prima della 1.4.7 gli
   * id potevano coincidere. I figli del «carico-1» dell'altro impianto
   * finivano nel modello di questo, e al salvataggio ci venivano scritti una
   * seconda volta, rinominati: un doppione per ogni elettrodomestico. */
  const { loadsConfigModel } = await import("../src/core/energy-loads-config.js");
  const { PRIMO_IMPIANTO } = await import("../src/core/energy-plants.js");
  const loads = [
    { ...primo },
    {
      id: "lav-giovanni",
      plant: "",
      name: "Lavatrice Giovanni",
      power_entity: "sensor.lav_g",
      metadata: { beta27_subload_group: "carico-1" },
    },
    {
      id: "carico-1",
      plant: "donato",
      name: "Cucina Donato",
      power_entity: "sensor.cucina_d",
      control_entity: "switch.cucina_d",
      metadata: { flow_group: "carico-1" },
    },
    {
      id: "lav-donato",
      plant: "donato",
      name: "Lavatrice Donato",
      power_entity: "sensor.lav_d",
      metadata: { beta27_subload_group: "carico-1" },
    },
  ];
  const donato = loadsConfigModel({ loads, plant: { id: "donato" }, plantIndex: 1 });
  assert.deepEqual(donato.map((load) => load.name), ["Cucina Donato"]);
  assert.deepEqual(donato[0].children.map((child) => child.id), ["lav-donato"]);
  const giovanni = loadsConfigModel({ loads, plant: { id: PRIMO_IMPIANTO }, plantIndex: 0 });
  assert.deepEqual(giovanni.map((load) => load.name), ["Cucina Giovanni"]);
  assert.deepEqual(giovanni[0].children.map((child) => child.id), ["lav-giovanni"]);
  /* E il codice lo dice: i figli si cercano fra i carichi di QUESTO impianto. */
  const core = leggi("core/energy-loads-config.js");
  assert.match(core, /const canonical = suoi\.filter\(subloadOf\(group\)\)/);
});

test("cambiando impianto le modifiche non salvate si mettono da parte, e tornando si ritrovano (revisione)", () => {
  const editor = leggi("sections/energy-loads-editor-section.js");
  const ascolto = editor.slice(editor.indexOf('"dashboardmodern:energy-plant-changed"'));
  assert.match(ascolto, /state\.bozze \|\|= new Map\(\);/);
  assert.match(ascolto, /if \(state\.dirty && state\.model && state\.impianto !== undefined\)\s*state\.bozze\.set\(state\.impianto, state\.model\);/);
  assert.match(ascolto, /const bozza = state\.bozze\.get\(adesso\) \|\| null;/);
  assert.match(ascolto, /state\.dirty = Boolean\(bozza\);/);
  /* Il modello sa di quale impianto e', e il salvataggio butta la sua bozza. */
  assert.match(editor, /state\.model = readModel\(\);\s*state\.impianto = chiaveImpianto\(\);/);
  assert.match(editor, /state\.bozze\?\.delete\?\.\(chiaveImpianto\(\)\);/);
});

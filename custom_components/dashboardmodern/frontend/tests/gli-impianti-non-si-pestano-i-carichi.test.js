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
  assert.match(
    editor,
    /addEventListener\?\.\("dashboardmodern:energy-plant-changed", \(\) => \{\s*state\.model = null;\s*state\.dirty = false;\s*scheduleRender\(\);/,
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

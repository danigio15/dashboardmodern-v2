/* «Le entità configurate diverse sui due impianti, soprattutto i carichi, poi
 * si mescolano con i due impianti.»
 *
 * `cd_flow_nodes` ha cinque caselle con un nome fisso — «boiler», «wb»,
 * «clima», «lav», «cuc» — una per cerchio, dal tempo in cui gli impianti erano
 * uno solo. Con due impianti i cerchi del secondo occupano le stesse del
 * primo, e quelle caselle non portano solo il nome: portano l'icona, il colore
 * e L'ENTITÀ DELLA POTENZA.
 *
 * Il disegno aveva già smesso di leggerle con più di un impianto (1.4.8). La
 * maschera che configura no — e quella è la maschera da cui si salva: apriva i
 * carichi della casa di sopra mostrando il boiler della casa di sotto, col suo
 * sensore, e «Salva carichi» glielo scriveva addosso.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { loadsConfigModel, specchioDeiCerchi } from "../src/core/energy-loads-config.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

/* La casa di sotto ha il boiler nel primo cerchio; la casa di sopra una pompa
 * di calore, e nient'altro in comune. */
const SPECCHIO_DI_SOTTO = {
  boiler: { name: "Boiler casa sotto", icon: "🔥", color: "#ea580c", pwr: "sensor.boiler1_w" },
};
const POMPA_DI_SOPRA = {
  id: "c-sopra",
  name: "Pompa di calore",
  power_entity: "sensor.pompa2_w",
  plant: "impianto-2",
};

const cerchioDiSopra = (flowNodes) =>
  loadsConfigModel({
    loads: [POMPA_DI_SOPRA],
    plant: { id: "impianto-2" },
    plantIndex: 1,
    flowNodes,
  })[0];

test("con due impianti lo specchio posizionale non parla più", () => {
  assert.equal(specchioDeiCerchi(SPECCHIO_DI_SOTTO, 2), null);
  /* Con uno solo resta quello di sempre: chi non ha chiesto il secondo
   * impianto non deve accorgersi che questa regola esiste. */
  assert.deepEqual(specchioDeiCerchi(SPECCHIO_DI_SOTTO, 1), SPECCHIO_DI_SOTTO);
  assert.equal(specchioDeiCerchi(null, 1), null);
  assert.equal(specchioDeiCerchi("niente", 1), null);
});

test("il cerchio della casa di sopra porta il SUO sensore, non quello di sotto", () => {
  const suo = cerchioDiSopra(specchioDeiCerchi(SPECCHIO_DI_SOTTO, 2));
  assert.equal(suo.power, "sensor.pompa2_w");
  assert.equal(suo.name, "Pompa di calore");
  assert.notEqual(suo.icon, "🔥");
});

test("e con un impianto solo lo specchio vale ancora, com'è sempre stato", () => {
  /* Chi ha rinominato il suo primo cerchio «Boiler» e gli ha scelto l'icona
   * non deve perderli: quelle caselle sono sue. */
  const solo = loadsConfigModel({
    loads: [{ id: "c1", name: "Carico 1", power_entity: "sensor.uno_w" }],
    plant: { id: "impianto" },
    plantIndex: 0,
    flowNodes: specchioDeiCerchi(SPECCHIO_DI_SOTTO, 1),
  })[0];
  assert.equal(solo.name, "Boiler casa sotto");
  assert.equal(solo.icon, "🔥");
  assert.equal(solo.power, "sensor.boiler1_w");
});

test("la decisione sta in un posto solo, e la usano tutti e due i lettori", () => {
  /* Era dentro un modulo di disegno, e l'altro lettore non aveva modo di
   * saperlo: è esattamente così che la maschera è rimasta indietro. */
  for (const percorso of [
    "src/sections/energy-flow-section.js",
    "src/sections/energy-loads-editor-section.js",
  ]) {
    const sorgente = readFileSync(join(RADICE, percorso), "utf8");
    assert.match(sorgente, /specchioDeiCerchi\(/);
    assert.match(sorgente, /from "\.\.\/core\/energy-loads-config\.js"/);
  }
  const editor = readFileSync(
    join(RADICE, "src/sections/energy-loads-editor-section.js"),
    "utf8",
  );
  assert.match(
    editor,
    /flowNodes: specchioDeiCerchi\(readJson\("cd_flow_nodes", null\), list\.length\)/,
  );
});

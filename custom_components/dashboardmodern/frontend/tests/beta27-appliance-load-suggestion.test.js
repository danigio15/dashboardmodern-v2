/* Il suggerimento verde accanto al select «Carico energia» (#214).
 *
 * Un elettrodomestico con la potenza mappata è quello che un cerchio del
 * flusso sa sommare: finché non è dentro nessun carico, l'editor lo dice lì
 * dove si sceglie. La condizione è pura e si prova da sola; il cablaggio nel
 * modale — markup, listener, stile — si verifica sul sorgente, come fanno gli
 * altri contratti di questo editor. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { flowGroupSuggested } from "../src/sections/appliance-editor-section.js";

const source = await readFile(
  new URL("../src/sections/appliance-editor-section.js", import.meta.url),
  "utf8",
);

test("the suggestion fires only with a mapped power and no group yet", () => {
  // Potenza mappata, nessun gruppo: c'è qualcosa da suggerire.
  assert.equal(flowGroupSuggested({ power_entity: "sensor.forno_power" }), true);
  // Un gruppo già scelto spegne il suggerimento, potenza o non potenza.
  assert.equal(
    flowGroupSuggested({
      power_entity: "sensor.forno_power",
      metadata: { beta27_subload_group: "cucina" },
    }),
    false,
  );
  // Senza potenza non c'è niente da suggerire.
  assert.equal(flowGroupSuggested({ name: "Forno" }), false);
  assert.equal(flowGroupSuggested(), false);
});

test("an inferred power sensor counts as a mapped power", () => {
  // La potenza può non stare in `power_entity`: basta un sensore in W tra le
  // entità dell'elettrodomestico, come per il precompilato del modale.
  globalThis.hass = {
    states: {
      "sensor.lavatrice_w": { attributes: { unit_of_measurement: "W" } },
      "switch.lavatrice": { attributes: {} },
    },
  };
  try {
    assert.equal(
      flowGroupSuggested({ entities: ["switch.lavatrice", "sensor.lavatrice_w"] }),
      true,
    );
    assert.equal(flowGroupSuggested({ entities: ["switch.lavatrice"] }), false);
  } finally {
    delete globalThis.hass;
  }
});

test("the modal wires the suggestion beside the load select and hides it on choice", () => {
  // Il badge sta dentro il campo «Carico energia», nello stile dei campi.
  assert.match(source, /data-dm-flow-suggestion\$\{flowGroupSuggested\(device\) \? "" : " hidden"\}/);
  assert.match(source, /Suggerito: ha una potenza mappata/);
  // Appena il select cambia, il listener rifà i conti: gruppo scelto = niente
  // suggerimento; gruppo tolto con potenza mappata = riappare.
  assert.match(
    source,
    /flowSuggestion\.hidden = Boolean\(clean\(flowSelect\.value\)\) \|\| !powerInitial;/,
  );
  // Verde nativo, e l'attributo hidden vince sul display forzato.
  assert.match(source, /\.dm-appliance-flow-suggestion\{[^}]*#16a34a/);
  assert.match(source, /\.dm-appliance-flow-suggestion\[hidden\]\{display:none!important\}/);
});

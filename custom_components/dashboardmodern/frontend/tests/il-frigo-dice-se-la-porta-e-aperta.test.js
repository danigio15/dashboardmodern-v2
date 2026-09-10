/* Il frigorifero dice se la porta è rimasta aperta (#471).
 *
 * «Potresti aggiungere un entità al frigorifero di apertura chiusura porta? il
 * classico sensore porte.»
 *
 * Su un frigorifero è l'unica cosa che vale la pena sapere di sfuggita. Non è
 * un allarme — un frigo aperto per prendere il latte non è un guasto — ma non
 * è nemmeno niente: è un fatto, e sta con gli altri fatti della card.
 *
 * Le tre risposte contano tutte e tre: aperta, chiusa, e «non lo so». Una
 * porta che non risponde mostrata come chiusa sarebbe una bugia
 * tranquillizzante, ed è il modo in cui questi sensori si rompono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { applianceDoor } from "../src/core/appliance-card-view-model.js";
import { proposeRoles } from "../src/core/appliance-device-binding.js";

const CASA = {
  "binary_sensor.frigo_porta": { entity_id: "binary_sensor.frigo_porta", state: "on" },
  "binary_sensor.congelatore_porta": {
    entity_id: "binary_sensor.congelatore_porta",
    state: "off",
  },
  "binary_sensor.porta_rotta": { entity_id: "binary_sensor.porta_rotta", state: "unavailable" },
  "sensor.forno_porta": { entity_id: "sensor.forno_porta", state: "DoorOpen" },
};

test("una porta aperta si legge, in tutti i dialetti in cui la scrivono", () => {
  assert.equal(applianceDoor({ door_entity: "binary_sensor.frigo_porta" }, CASA), true);
  assert.equal(applianceDoor({ door_entity: "binary_sensor.congelatore_porta" }, CASA), false);
  /* Certe integrazioni la porta la dichiarano a parole, non con un booleano. */
  assert.equal(applianceDoor({ door_entity: "sensor.forno_porta" }, CASA), true);
});

test("una porta che non c'è o non risponde non è una porta chiusa", () => {
  assert.equal(applianceDoor({}, CASA), null);
  assert.equal(applianceDoor({ door_entity: "" }, CASA), null);
  assert.equal(applianceDoor({ door_entity: "binary_sensor.mai_vista" }, CASA), null);
  assert.equal(applianceDoor({ door_entity: "binary_sensor.porta_rotta" }, CASA), null);
});

test("la card dice la porta aperta e tace su quella chiusa", async () => {
  const sezione = await readFile(
    new URL("../src/sections/appliance-showcase-section.js", import.meta.url),
    "utf8",
  );
  /* Una pastiglia «porta chiusa» su ogni frigo di casa e' rumore: si dice solo
   * quello che chiede di essere fatto. */
  assert.ok(sezione.includes("model?.door !== true"), "la card parla anche della porta chiusa");
  assert.ok(sezione.includes('data-fact="porta"'), "la porta non sta fra i fatti");
  const scheda = await readFile(
    new URL("../src/sections/appliance-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.ok(scheda.includes('"door_entity"'), "la casella della porta non si salva");
  assert.ok(scheda.includes('entityField("door_entity"'), "la casella della porta non si vede");
});

test("il contatto della porta si riconosce da solo dal dispositivo", () => {
  /* Chi adotta il frigorifero da un'integrazione non deve andare a cercare
   * l'entita' della porta: la porta si dichiara col suo `device_class`. */
  const scelte = proposeRoles(
    [
      { entity_id: "binary_sensor.frigo_porta", name: "Frigo porta", device_class: "door" },
      { entity_id: "sensor.frigo_temperatura", name: "Frigo temperatura" },
    ],
    {
      "binary_sensor.frigo_porta": { attributes: { device_class: "door" } },
      "sensor.frigo_temperatura": { attributes: { device_class: "temperature" } },
    },
    { type: "fridge", deviceName: "Frigo" },
  );
  assert.equal(scelte?.door_entity, "binary_sensor.frigo_porta");
});

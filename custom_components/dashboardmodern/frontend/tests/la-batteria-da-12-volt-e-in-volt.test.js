/* La batteria di servizio si legge nell'unita' in cui arriva (#348).
 *
 * «Nella sezione batteria 12 V in questo momento e' a 14 V, mi da' 14%.» La
 * casella era una percentuale e basta: un sensore in volt — la forma in cui
 * meta' delle integrazioni pubblica la batteria da 12 V — veniva tagliato a
 * cento e mostrato col simbolo sbagliato. Qui si tiene fermo che percento e'
 * un livello, volt e' una tensione, e che la pagina scrive quello che ha
 * letto; e che l'integrazione sa collegare anche un sensore in volt.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { batteriaDalloStato, letturaTermica } from "../src/core/auto-termica.js";
import { legaLAutoAlDispositivo } from "../src/core/auto-device-binding.js";

const stato = (state, attributes = {}) => ({ state, attributes });
const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("percento e' un livello, volt e' una tensione", () => {
  assert.deepEqual(batteriaDalloStato("14", "V"), { valore: 14, unita: "V" });
  assert.deepEqual(batteriaDalloStato("14.2", "V"), { valore: 14.2, unita: "V" });
  assert.deepEqual(batteriaDalloStato("12800", "mV"), { valore: 12.8, unita: "V" });
  assert.deepEqual(batteriaDalloStato("86", "%"), { valore: 86, unita: "%" });
  /* Senza unita' e' un livello, com'e' sempre stato: fra zero e cento. */
  assert.deepEqual(batteriaDalloStato("120", ""), { valore: 100, unita: "%" });
  /* Una tensione non si taglia a cento: quattordici volt sono quattordici. */
  assert.equal(batteriaDalloStato("14", "V").valore, 14);
  assert.equal(batteriaDalloStato("unknown", "V"), null);
  assert.equal(batteriaDalloStato("", "%"), null);
});

test("la lettura porta il numero e la sua unita', e chi disegna scrive quella", () => {
  const inVolt = letturaTermica(
    { "dm.ev_batteria_servizio": "sensor.auto_12v" },
    { "sensor.auto_12v": stato("14.2", { unit_of_measurement: "V" }) },
  );
  assert.equal(inVolt.batteriaServizio, 14.2);
  assert.equal(inVolt.batteriaServizioUnita, "V");
  const inPercento = letturaTermica(
    { "dm.ev_batteria_servizio": "sensor.auto_12v_level" },
    { "sensor.auto_12v_level": stato("86", { unit_of_measurement: "%" }) },
  );
  assert.equal(inPercento.batteriaServizio, 86);
  assert.equal(inPercento.batteriaServizioUnita, "%");
  /* Non mappata: niente, non zero e non «%». */
  const senza = letturaTermica({}, {});
  assert.equal(senza.batteriaServizio, undefined);
  /* Mappata ma muta: null, e la casella non si disegna. */
  const muta = letturaTermica(
    { "dm.ev_batteria_servizio": "sensor.auto_12v" },
    { "sensor.auto_12v": stato("unavailable", { unit_of_measurement: "V" }) },
  );
  assert.equal(muta.batteriaServizio, null);
});

test("la pagina scrive l'unita' letta, non un «%» deciso a tavolino", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  assert.match(sezione, /lettura\.batteriaServizioUnita === "%" \? "%" : ` \$\{lettura\.batteriaServizioUnita\}`/);
  assert.doesNotMatch(
    sezione,
    /lettura\.batteriaServizio, "%"/,
    "la casella della batteria di servizio non deve piu' avere il percento cablato",
  );
  /* E l'etichetta nella scheda dice che accetta tutte e due. */
  assert.match(sezione, /Batteria di servizio 12 V \(% o V\)/);
});

test("l'integrazione collega anche una batteria da 12 V pubblicata in volt", () => {
  const ent = (entity_id, name, extra = {}) => ({ entity_id, name, disabled: false, ...extra });
  const { mappa } = legaLAutoAlDispositivo({
    entities: [
      ent("sensor.auto_soc", "Battery", { device_class: "battery", unit: "%" }),
      ent("sensor.auto_12v_battery_voltage", "12V battery voltage", {
        device_class: "voltage",
        unit: "V",
      }),
      /* Una tensione qualunque non e' la batteria di servizio. */
      ent("sensor.auto_charger_voltage", "Charger voltage", { device_class: "voltage", unit: "V" }),
    ],
  });
  assert.equal(mappa["dm.ev_batteria_servizio"], "sensor.auto_12v_battery_voltage");
  assert.equal(mappa["dm.ev_batteria_auto"], "sensor.auto_soc");
  /* Il livello in percento, quando c'e', vince sulla tensione. */
  const { mappa: conLivello } = legaLAutoAlDispositivo({
    entities: [
      ent("sensor.auto_12v_battery_voltage", "12V battery voltage", { unit: "V" }),
      ent("sensor.auto_12v_battery_level", "12V battery level", { unit: "%" }),
    ],
  });
  assert.equal(conLivello["dm.ev_batteria_servizio"], "sensor.auto_12v_battery_level");
});

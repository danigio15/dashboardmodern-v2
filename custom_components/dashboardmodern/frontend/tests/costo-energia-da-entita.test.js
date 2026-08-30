/* Il costo dell'energia puo' venire da un'entita' (#217).
 *
 * Chi compra a prezzo di borsa non ha UN numero da scrivere nella scheda: ha
 * un sensore che lo dice, e cambia da solo piu' volte al giorno. La tariffa
 * quindi ha una sola porta d'ingresso, `resolveRate`: entra un numero, una
 * stringa numerica o l'id di un'entita' — e in quel caso vale il suo stato —
 * ed escono gli euro al kWh con cui tutti fanno i conti.
 *
 * I default vivono li' dentro e da nessun'altra parte, con la semantica di
 * sempre: un valore sopra lo zero vince, tutto il resto cade sul default. Lo
 * zero esplicito non vince, perche' il salvataggio non lo scrive mai apposta.
 *
 * E la scelta «da entita'» abita nel modello energia canonico
 * (`sections.energy.rates.import_entity`): la prova piu' importante e' che
 * sopravviva alla normalizzazione, perche' un campo che il normalizzatore non
 * conosce e' un campo che il primo salvataggio qualunque butta via.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEFAULT_EXPORT_RATE,
  DEFAULT_IMPORT_RATE,
  importRateEntity,
  resolveRate,
} from "../src/core/energy-calculations.js";
import { migrateEnergy, migrateState } from "../src/core/migrations.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(QUI, "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("un numero, una stringa numerica e la virgola valgono uguale", () => {
  assert.equal(resolveRate(0.31, {}, DEFAULT_IMPORT_RATE), 0.31);
  assert.equal(resolveRate("0.31", {}, DEFAULT_IMPORT_RATE), 0.31);
  assert.equal(resolveRate("0,31", {}, DEFAULT_IMPORT_RATE), 0.31);
});

test("un id di entita' vale il suo stato, virgola compresa", () => {
  const states = {
    "sensor.pun_prezzo": { state: "0.1132" },
    "sensor.prezzo_virgola": { state: "0,1132" },
  };
  assert.equal(resolveRate("sensor.pun_prezzo", states, DEFAULT_IMPORT_RATE), 0.1132);
  assert.equal(resolveRate("sensor.prezzo_virgola", states, DEFAULT_IMPORT_RATE), 0.1132);
});

test("lo zero esplicito non vince: cade sul default, come il vuoto", () => {
  assert.equal(resolveRate(0, {}, DEFAULT_IMPORT_RATE), DEFAULT_IMPORT_RATE);
  assert.equal(resolveRate("0", {}, DEFAULT_IMPORT_RATE), DEFAULT_IMPORT_RATE);
  assert.equal(resolveRate("", {}, DEFAULT_EXPORT_RATE), DEFAULT_EXPORT_RATE);
  assert.equal(resolveRate(null, {}, DEFAULT_EXPORT_RATE), DEFAULT_EXPORT_RATE);
  assert.equal(resolveRate(-0.2, {}, DEFAULT_IMPORT_RATE), DEFAULT_IMPORT_RATE);
});

test("un'entita' sparita o non numerica cade sul default, non su NaN", () => {
  assert.equal(resolveRate("sensor.sparita", {}, DEFAULT_IMPORT_RATE), DEFAULT_IMPORT_RATE);
  assert.equal(
    resolveRate("sensor.giu", { "sensor.giu": { state: "unavailable" } }, DEFAULT_IMPORT_RATE),
    DEFAULT_IMPORT_RATE,
  );
  assert.equal(
    resolveRate("sensor.zero", { "sensor.zero": { state: "0" } }, DEFAULT_IMPORT_RATE),
    DEFAULT_IMPORT_RATE,
  );
});

test("chi non ha un default suo puo' chiedere il nulla, non un numero inventato", () => {
  /* La vetrina degli elettrodomestici senza prezzo non mostra il costo del
   * ciclo: il suo ripiego e' null, e resolveRate lo restituisce tale e quale. */
  assert.equal(resolveRate("", {}, null), null);
  assert.equal(resolveRate("sensor.sparita", {}, null), null);
});

test("«0.25» resta un numero anche se contiene un punto", () => {
  /* Il riconoscimento dell'entita' guarda il dominio, non il punto: una
   * stringa che comincia con una cifra non e' mai una lettura da fare. */
  assert.equal(resolveRate("0.25", { "0.25": { state: "9" } }, 0.1), 0.25);
});

test("i default canonici sono quelli di sempre", () => {
  assert.equal(DEFAULT_IMPORT_RATE, 0.25);
  assert.equal(DEFAULT_EXPORT_RATE, 0.1);
});

test("importRateEntity legge il campo canonico e ripulisce gli spazi", () => {
  assert.equal(importRateEntity({ rates: { import_entity: " sensor.pun_prezzo " } }), "sensor.pun_prezzo");
  assert.equal(importRateEntity({}), "");
  assert.equal(importRateEntity(null), "");
});

test("la scelta da entita' sopravvive alla normalizzazione del modello energia", () => {
  const normalizzato = migrateEnergy({
    grid: { total_import_energy: "sensor.import" },
    rates: { import_entity: "sensor.pun_prezzo" },
  });
  assert.deepEqual(normalizzato.rates, { import_entity: "sensor.pun_prezzo" });
  /* E senza scelta il campo non nasce dal nulla: il modello resta com'era. */
  assert.equal("rates" in migrateEnergy({ grid: {} }), false);
  assert.equal("rates" in migrateEnergy({ rates: { import_entity: "  " } }), false);
});

test("la scelta sopravvive anche al giro completo delle migrazioni", () => {
  const { state } = migrateState({
    schema_version: 4,
    sections: {
      rooms: [],
      energy: {
        grid: { total_import_energy: "sensor.import" },
        metadata: { semantics_version: 4, energy_loads_migrated: true },
        rates: { import_entity: "sensor.pun_prezzo" },
      },
    },
  });
  assert.equal(state.sections.energy.rates.import_entity, "sensor.pun_prezzo");
});

test("il salvataggio canonico scrive la scelta nel modello, non in una chiave sciolta", () => {
  const polish = leggi("sections/energy-report-polish-section.js");
  assert.match(polish, /persistEnergyField\(\s*root\.DashboardModernModules\?\.store,\s*"rates",\s*"import_entity"/);
  /* E il lettore del Report chiede prima l'entita' del modello. */
  assert.match(polish, /importRateEntity\(model\(\)\)/);
});

test("le due schede del Costo energia offrono il segmentato Numero | Entita'", () => {
  const beta22 = leggi("sections/beta22-load-slots-hotfix-section.js");
  const entrata = readFileSync(join(QUI, "..", "legacy", "modules-entry.js"), "utf8");
  for (const [nome, testo] of [["beta22-load-slots-hotfix-section.js", beta22], ["modules-entry.js", entrata]]) {
    assert.match(testo, /data-dm-rate-mode="number"/, nome);
    assert.match(testo, /data-dm-rate-mode="entity"/, nome);
    /* Il campo entita' e' quello vero, non un input nudo. */
    assert.match(testo, /createEntityPickerField\(/, nome);
    assert.match(testo, /ed-costo-kwh-entita/, nome);
  }
});

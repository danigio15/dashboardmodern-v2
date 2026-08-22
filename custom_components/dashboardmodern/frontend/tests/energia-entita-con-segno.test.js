import assert from "node:assert/strict";
import test from "node:test";

import {
  applySignedSources,
  derivedEntityId,
  derivedEnergyStates,
  isDerivedEntity,
  signedSource,
  signedSourceEntities,
  splitSignedReading,
} from "../src/core/signed-energy.js";
import { projectEnergySlots } from "../src/core/energy-projection.js";
import {
  flushEnergyWrites,
  persistEnergyField,
  persistSignedSource,
} from "../src/core/energy-writer.js";

const stato = (value, unit = "kWh") => ({
  state: String(value),
  attributes: { unit_of_measurement: unit },
});

test("un gruppo senza dichiarazione resta com'e'", () => {
  const energy = { grid: { daily_import_energy: "sensor.prelievo" } };
  assert.equal(signedSource(energy, "grid"), null);
  assert.equal(applySignedSources(energy), energy);
  assert.deepEqual(derivedEnergyStates(energy, {}), {});
  assert.deepEqual(signedSourceEntities(energy), []);
});

/* Il verso da solo tiene aperta la scheda, ma non comanda niente.
 *
 * Prima questa prova pretendeva `null`, ed era il difetto messo per iscritto:
 * la scheda mette il verso prima delle caselle, quindi lo si sceglie quando
 * di entita' non ce n'e' ancora nessuna, e rispondere «non c'e' nessuna
 * dichiarazione» faceva richiudere la scheda e perdere la scelta. Adesso la
 * dichiarazione c'e' — e continua a non ricavare niente, che era ed e' la
 * cosa importante. */
test("una dichiarazione senza entita' non comanda niente", () => {
  const energy = { battery: { signed: { positive: "charge" } } };
  const sorgente = signedSource(energy, "battery");
  assert.ok(sorgente, "la scheda resta aperta su quello che si e' scelto");
  assert.equal(sorgente.positive, "charge");
  assert.deepEqual(sorgente.entities, {}, "nessuna casella compilata");
  assert.equal(applySignedSources(energy), energy, "e il modello non si tocca");
  assert.deepEqual(derivedEnergyStates(energy, {}), {});
  assert.deepEqual(signedSourceEntities(energy), []);
});

test("la rete con i positivi in prelievo usa l'entita' cosi' com'e'", () => {
  const energy = { grid: { signed: { power: "sensor.rete_w", positive: "import" } } };
  const resolved = applySignedSources(energy);
  assert.equal(resolved.grid.power, "sensor.rete_w");
  assert.deepEqual(derivedEnergyStates(energy, {}), {});
});

test("la rete con i positivi in immissione ribalta il segno della potenza", () => {
  const energy = { grid: { signed: { power: "sensor.rete_w", positive: "export" } } };
  const resolved = applySignedSources(energy);
  assert.equal(resolved.grid.power, derivedEntityId("grid", "power"));
  const derived = derivedEnergyStates(energy, { "sensor.rete_w": stato(-1200, "W") });
  assert.equal(derived[derivedEntityId("grid", "power")].state, "1200");
});

test("un contatore di rete con segno diventa prelievo e immissione", () => {
  const energy = { grid: { signed: { daily: "sensor.rete_oggi", positive: "import" } } };
  const resolved = applySignedSources(energy);
  assert.equal(resolved.grid.daily_import_energy, derivedEntityId("grid", "daily_import_energy"));
  assert.equal(resolved.grid.daily_export_energy, derivedEntityId("grid", "daily_export_energy"));

  const prelievo = derivedEnergyStates(energy, { "sensor.rete_oggi": stato(7.4) });
  assert.equal(prelievo[derivedEntityId("grid", "daily_import_energy")].state, "7.4");
  assert.equal(prelievo[derivedEntityId("grid", "daily_export_energy")].state, "0");

  const immissione = derivedEnergyStates(energy, { "sensor.rete_oggi": stato(-3.2) });
  assert.equal(immissione[derivedEntityId("grid", "daily_import_energy")].state, "0");
  assert.equal(immissione[derivedEntityId("grid", "daily_export_energy")].state, "3.2");
});

test("la batteria col verso invertito assegna i positivi alla carica", () => {
  const energy = { battery: { signed: { daily: "sensor.batt_oggi", positive: "charge" } } };
  const caricata = derivedEnergyStates(energy, { "sensor.batt_oggi": stato(5) });
  assert.equal(caricata[derivedEntityId("battery", "daily_charged_energy")].state, "5");
  assert.equal(caricata[derivedEntityId("battery", "daily_discharged_energy")].state, "0");

  const scaricata = derivedEnergyStates(energy, { "sensor.batt_oggi": stato(-2) });
  assert.equal(scaricata[derivedEntityId("battery", "daily_charged_energy")].state, "0");
  assert.equal(scaricata[derivedEntityId("battery", "daily_discharged_energy")].state, "2");
});

test("una lettura che non c'e' resta non disponibile invece di valere zero", () => {
  const energy = { grid: { signed: { daily: "sensor.rete_oggi", positive: "import" } } };
  const derived = derivedEnergyStates(energy, { "sensor.rete_oggi": stato("unavailable") });
  assert.equal(derived[derivedEntityId("grid", "daily_import_energy")].state, "unavailable");
  assert.equal(derived[derivedEntityId("grid", "daily_export_energy")].state, "unavailable");
});

test("la parte positiva e quella negativa di una lettura", () => {
  assert.deepEqual(splitSignedReading("4.5"), { positive: 4.5, negative: 0 });
  assert.deepEqual(splitSignedReading("-4.5"), { positive: 0, negative: 4.5 });
  assert.deepEqual(splitSignedReading("ciao"), { positive: null, negative: null });
});

test("la proiezione degli slot passa dalle letture ricavate", () => {
  const energy = {
    grid: { signed: { daily: "sensor.rete_oggi", positive: "import" } },
    battery: { signed: { power: "sensor.batt_w", positive: "charge" } },
  };
  const slots = projectEnergySlots(applySignedSources(energy), {});
  assert.equal(
    slots["dm.energy_energia_prelevata_oggi"],
    derivedEntityId("grid", "daily_import_energy"),
  );
  assert.equal(
    slots["dm.energy_energia_immessa_oggi"],
    derivedEntityId("grid", "daily_export_energy"),
  );
  assert.equal(slots["dm.energy_potenza_batteria"], derivedEntityId("battery", "power"));
  assert.ok(isDerivedEntity(slots["dm.energy_potenza_batteria"]));
});

test("le entita' vere da cui dipendono le letture si sanno elencare", () => {
  const energy = {
    grid: { signed: { daily: "sensor.rete_oggi", positive: "import" } },
    battery: { signed: { power: "sensor.batt_w", monthly: "sensor.batt_mese" } },
  };
  assert.deepEqual(signedSourceEntities(energy).sort(), [
    "sensor.batt_mese",
    "sensor.batt_w",
    "sensor.rete_oggi",
  ]);
});

function storeFinto(energy = {}) {
  const stato = { energy: structuredClone(energy) };
  return {
    scritture: 0,
    getSection(name) {
      return structuredClone(stato[name] ?? {});
    },
    async replaceSection(name, value) {
      this.scritture += 1;
      stato[name] = structuredClone(value);
    },
    leggi: () => structuredClone(stato.energy),
  };
}

test("due campi salvati di seguito non si riportano indietro a vicenda", async () => {
  const store = storeFinto({ grid: { daily_import_energy: "sensor.vecchio" } });
  persistEnergyField(store, "grid", "daily_import_energy", "sensor.prelievo");
  persistEnergyField(store, "grid", "total_import_energy", "sensor.prelievo_totale");
  await flushEnergyWrites();
  assert.deepEqual(store.leggi().grid, {
    daily_import_energy: "sensor.prelievo",
    total_import_energy: "sensor.prelievo_totale",
  });
});

test("la sorgente unica si scrive e si toglie per intero", async () => {
  const store = storeFinto({ grid: {} });
  await persistSignedSource(store, "grid", { power: "sensor.rete_w", positive: "export" });
  assert.deepEqual(store.leggi().grid.signed, { power: "sensor.rete_w", positive: "export" });
  /* Svuotare la casella del sensore non e' rinunciare alla sorgente unica: il
   * verso scelto resta, altrimenti cancellando per riscrivere si perderebbe. */
  await persistSignedSource(store, "grid", { power: "", positive: "export" });
  assert.deepEqual(store.leggi().grid.signed, { positive: "export" });
  // A toglierla per intero e' la spunta, che manda il vuoto.
  await persistSignedSource(store, "grid", {});
  assert.equal("signed" in store.leggi().grid, false);
});

/* Chi salva non riporta indietro la versione delle semantiche.
 *
 * La migrazione porta il modello Energia alla versione 4 e lo dichiara; chi
 * salva un campo lo riscriveva alla 3, e al caricamento successivo la
 * migrazione ripartiva — segnalata a ogni avvio nella console, con tutto il
 * salvataggio che si porta dietro. Due padroni sullo stesso numero. */
import { migrateState } from "../src/core/migrations.js";

function migrazioneDi(energy) {
  return migrateState({ schema_version: 4, sections: { energy }, visibility: {} }, {}).changes;
}

test("un modello gia' migrato non si rimigra a ogni avvio", () => {
  const gia = {
    house: {},
    grid: {},
    solar: {},
    battery: {},
    metadata: { semantics_version: 4, energy_loads_migrated: true },
  };
  assert.deepEqual(migrazioneDi(gia), []);
});

test("salvare un campo non riporta indietro la versione", async () => {
  const store = storeFinto({
    house: {},
    grid: {},
    solar: {},
    battery: {},
    metadata: { semantics_version: 4, energy_loads_migrated: true },
  });
  await persistEnergyField(store, "grid", "daily_import_energy", "sensor.prelievo");
  assert.equal(store.leggi().metadata.semantics_version, 4);
  assert.deepEqual(migrazioneDi(store.leggi()), []);
});

test("un modello senza versione la riceve, cosi' non gli si rifanno gli alias", async () => {
  const store = storeFinto({ grid: {} });
  await persistEnergyField(store, "grid", "daily_import_energy", "sensor.prelievo");
  // Tre e' la soglia sotto la quale la migrazione ricrea i vecchi alias: un
  // campo annuale svuotato apposta non deve tornare da solo.
  assert.ok(store.leggi().metadata.semantics_version >= 3);
});

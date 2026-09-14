/* «Il flow dovrebbe essere dal FV verso casa ed è corretto, ma poi dovrebbe
 *  anche caricare la batteria mentre in questo momento sembra scaricarsi
 *  perché il flow tratteggiato va dalla batteria verso casa» (#434), e poi
 * «adesso ho il flusso, ma è sempre da batteria verso casa, ho provato anche a
 *  cambiare il senso ma non cambia» (#435).
 *
 * La mappa dei flussi ha una convenzione sola: positivo = scarica. I sensori
 * no. Un solo numero col segno lo pubblicano tutti, e metà lo scrivono positivo
 * quando la batteria si CARICA: da un valore solo non si indovina, e chi guarda
 * vede le frecce all'incontrario.
 *
 * Lo dice la casa, una volta sola. «Una volta sola» è la cosa che la #435 ha
 * rotto: il verso valeva soltanto per la casella della sorgente unica, e chi il
 * sensore lo aveva scritto nella casella «Potenza» di sempre cambiava il verso
 * senza cambiare niente. Qui si tiene ferma la regola nuova: il verso è una
 * proprietà del SENSORE, e si applica dove l'entità si risolve — così lo legge
 * già girato chiunque disegni, guscio storico compreso.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { allocateSourceFlows, batteryReadout } from "../src/core/energy-flow-truth.js";
import {
  applySignedSources,
  derivedEnergyStates,
  signedSourceEntities,
} from "../src/core/signed-energy.js";
import { projectEnergySlots } from "../src/core/energy-projection.js";
import { migrateState } from "../src/core/migrations.js";
import { DashboardStore } from "../src/core/dashboard-store.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const BATT = "sensor.batteria_potenza";
const watt = (valore) => ({
  entity_id: BATT,
  state: String(valore),
  attributes: { unit_of_measurement: "W" },
});

/* La casa di chi ha segnalato: il sensore sta nella casella «Potenza» di
 * sempre, che è il posto ovvio ed è quello che la plancia stessa consiglia. */
const casaDella435 = (positive) => ({
  battery: { power: BATT, signed: positive ? { positive } : undefined },
});

test("il verso dichiarato gira la potenza anche fuori dalla sorgente unica", () => {
  /* È la #435 in una riga: prima questa dichiarazione non toccava la casella
   * «Potenza», e la mappa continuava a leggere 1500 come scarica. */
  const risolto = applySignedSources(casaDella435("charge"));
  assert.equal(risolto.battery.power, "dm_derived.battery_power");

  const stati = derivedEnergyStates(casaDella435("charge"), { [BATT]: watt(1500) });
  assert.equal(stati["dm_derived.battery_power"].state, "-1500");
  /* L'unità resta quella del sensore: cambia il segno, non la grandezza. */
  assert.equal(stati["dm_derived.battery_power"].attributes.unit_of_measurement, "W");

  /* E la lettura ricavata deve sapere da quale entità nasce, o non troverebbe
   * niente da negare. */
  assert.deepEqual(signedSourceEntities(casaDella435("charge")), [BATT]);
});

test("chi non dichiara niente resta esattamente com'era", () => {
  /* La regola che rende sicura questa correzione per tutte le case a cui il
   * disegno andava già bene. */
  const fermo = applySignedSources(casaDella435(null));
  assert.equal(fermo.battery.power, BATT);
  assert.deepEqual(derivedEnergyStates(casaDella435(null), { [BATT]: watt(1500) }), {});

  /* E dichiarare il verso di serie non inventa una lettura ricavata. */
  const serie = applySignedSources(casaDella435("discharge"));
  assert.equal(serie.battery.power, BATT);
  assert.deepEqual(derivedEnergyStates(casaDella435("discharge"), { [BATT]: watt(1500) }), {});
});

test("la coppia di sensori vince, e il verso non la gira una seconda volta", () => {
  /* Due sensori separati, sempre positivi: lì il verso non è una domanda, ci
   * pensa la sottrazione. Applicare anche il verso dichiarato vorrebbe dire
   * negare un numero che ha già il segno giusto. */
  const coppia = {
    battery: { power: BATT, power_discharge: "sensor.batteria_scarica", signed: { positive: "charge" } },
  };
  const stati = {
    [BATT]: watt(1500),
    "sensor.batteria_scarica": {
      entity_id: "sensor.batteria_scarica",
      state: "0",
      attributes: { unit_of_measurement: "W" },
    },
  };
  /* scarica - carica = 0 - 1500: la carica, col segno di qui. */
  assert.equal(derivedEnergyStates(coppia, stati)["dm_derived.battery_power"].state, "-1500");
  assert.equal(applySignedSources(coppia).battery.power, "dm_derived.battery_power");
});

test("una volta sola: il guscio storico legge lo stesso numero girato", () => {
  /* Il guscio disegna le stesse linee leggendo `dm.energy_potenza_batteria`.
   * La proiezione fa scendere quell'alias sulla lettura ricavata, quindi il
   * numero già girato arriva anche a lui — senza una seconda regola da
   * mantenere, e senza che lui debba sapere niente di tutto questo. */
  const alias = projectEnergySlots(applySignedSources(casaDella435("charge")), {});
  assert.equal(alias["dm.energy_potenza_batteria"], "dm_derived.battery_power");
});

test("con il verso giusto la mappa disegna la carica, non la scarica", () => {
  /* La casa di chi ha segnalato: il fotovoltaico produce, la casa consuma meno
   * di quello che arriva, e la batteria si sta caricando. */
  const solare = 4000;
  const rete = -200;

  const comEra = allocateSourceFlows({ solar: solare, grid: rete, battery: 1500 });
  /* Prima: «positivo = scarica» letto alla lettera, e la batteria alimenta
   * casa. È la freccia sbagliata della segnalazione. */
  assert.ok(comEra.batteryToHome > 0);
  assert.equal(comEra.solarToBattery, 0);

  const girata = allocateSourceFlows({ solar: solare, grid: rete, battery: -1500 });
  /* Dopo: il solare carica la batteria, e dalla batteria non esce niente. */
  assert.equal(girata.batteryToHome, 0);
  assert.equal(girata.solarToBattery, 1500);
  assert.ok(girata.solarToHome > 0);
});

test("anche la bolla dice la stessa cosa della mappa", () => {
  /* La freccia della bolla e quella della mappa vengono dallo stesso numero:
   * due letture dello stesso segno non possono discordare. */
  assert.equal(batteryReadout(-1500), "▼ 1500 W");
  assert.equal(batteryReadout(1500), "▲ 1500 W");
});

test("l'istantanea decide dagli stati, mai dal testo della bolla", async () => {
  const flusso = await leggi("../src/sections/energy-flow-section.js");
  /* La bolla non dice più il numero col segno: dice grandezza e verso, «▼ 201
   * W». Chi leggeva quel testo per sapere da che parte andasse la linea
   * ritrovava sempre un numero positivo — cioè sempre «batteria → casa»,
   * qualunque verso fosse dichiarato. Era il «è sempre da batteria verso casa»
   * anche dopo la correzione del verso. */
  assert.match(flusso, /if \(!period\) \{[\s\S]*?potenzaViva\(SORGENTI_ISTANTANEE\[kind\]\)/);
  /* E il testo resta buono solo per i periodi, dove i due versi sono scritti
   * in due caselle diverse e il segno non serve. */
  const dentro = flusso.slice(
    flusso.indexOf("function directionalEndpointValue("),
    flusso.indexOf("function directionalMainFlowValue("),
  );
  assert.doesNotMatch(dentro, /parseNumber\(valueNode\)/);
});

test("un interruttore solo: il verso non si dice più in due posti", async () => {
  /* Due interruttori per lo stesso fatto sono un modo sicuro di non farne
   * funzionare nessuno: chi ne trovava uno non sapeva che l'altro esisteva, e
   * chi li toccava tutti e due si annullavano. */
  for (const rel of [
    "../src/sections/energy-flow-section.js",
    "../src/sections/home-widgets-section.js",
    "../src/core/energy-flow-truth.js",
  ]) {
    const sorgente = await leggi(rel);
    assert.doesNotMatch(sorgente, /cd_batteria_verso|batteriaGirata|potenzaDellaBatteria/, rel);
  }
});

test("chi aveva girato il vecchio interruttore se lo ritrova, una volta sola", () => {
  const stato = {
    schema_version: 4,
    sections: { energy: { battery: { power: BATT } } },
  };
  const primo = migrateState(stato, { batteryDirection: { girata: true } });
  assert.equal(primo.state.sections.energy.battery.signed.positive, "charge");
  assert.equal(primo.state.sections.energy.metadata.battery_direction_migrated, true);

  /* E poi non si rifà: chi dopo la migrazione torna a «scarica» deve restarci,
   * anche se la vecchia chiave è ancora lì sul disco. */
  const scelta = primo.state;
  scelta.sections.energy.battery.signed.positive = "discharge";
  const secondo = migrateState(scelta, { batteryDirection: { girata: true } });
  assert.equal(secondo.state.sections.energy.battery.signed.positive, "discharge");

  /* Chi non l'aveva girato non si ritrova niente addosso. */
  const fermo = migrateState(
    { schema_version: 4, sections: { energy: { battery: { power: BATT } } } },
    {},
  );
  assert.equal(fermo.state.sections.energy.battery.signed, undefined);
});

/* Una migrazione che nessuno vede è una migrazione che non c'è.
 *
 * All'avvio le chiavi legacy dettano — la copia canonica può restare indietro
 * di un giro — ma dettano PRIMA che il modello si migri, non dopo. Se
 * parlassero dopo riscriverebbero il modello appena migrato con quello vecchio,
 * il segno nel `metadata` insieme al lavoro: la migrazione si rifarebbe a ogni
 * avvio e chi aveva girato il vecchio interruttore non se lo ritroverebbe mai.
 */
class DiscoFinto {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test("il verso migrato sopravvive alle chiavi legacy dell'avvio", () => {
  const storage = new DiscoFinto();
  storage.setItem("cd_batteria_verso", JSON.stringify({ girata: true }));
  /* La chiave legacy c'è, ed è quella di prima: senza `signed`, senza segni. */
  storage.setItem("cd_energy_model", JSON.stringify({ battery: { power: BATT } }));
  storage.setItem(
    "dm_dashboard_state",
    JSON.stringify({ schema_version: 4, sections: { energy: { battery: { power: BATT } } } }),
  );

  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();

  const energia = store.getState().sections.energy;
  assert.equal(energia.battery.signed.positive, "charge");
  assert.equal(energia.metadata.battery_direction_migrated, true);

  /* E il segno arriva sul disco, se no il giro dopo si ricomincia da capo. */
  const suDisco = JSON.parse(storage.getItem("cd_energy_model"));
  assert.equal(suDisco.battery.signed.positive, "charge");
  assert.equal(suDisco.metadata.battery_direction_migrated, true);

  /* Chi dopo la migrazione torna a «scarica» deve restarci, anche con la
   * vecchia chiave ancora lì sul disco: è il segno che glielo garantisce. */
  const scelta = JSON.parse(storage.getItem("cd_energy_model"));
  scelta.battery.signed.positive = "discharge";
  storage.setItem("cd_energy_model", JSON.stringify(scelta));
  const secondo = new DashboardStore({ storage, sync: async () => {} });
  secondo.migrate();
  assert.equal(secondo.getState().sections.energy.battery.signed.positive, "discharge");
});

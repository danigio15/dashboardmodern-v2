/* Due frigoriferi non si scambiano i sensori (#417).
 *
 * «Il frigorifero 1 posto in cucina prende correttamente il sensore di potenza
 * (uno shelly em) ma mi mostra il valore di un sensore di temperatura zigbee
 * che ho messo all'interno di un diverso frigorifero (frigorifero 2) che si
 * trova in un'altra stanza. Se vado in configurazione vedo che mi associa in
 * automatico una presa smart che è collegata al frigorifero 2. Anche se
 * cancello l'associazione, quando ritorno in configurazione me la ritrovo
 * sempre la presa smart incriminata. Mi ricarica sempre in automatico circa 30
 * sensori, non riesco a togliere quelli errati in nessun modo.»
 *
 * La passata che indovina le entità dai nomi cercava con UNA parola sola e fra
 * quelle parole c'era il TIPO — «frigo» — che ce l'hanno tutti i frigoriferi.
 * Il numero, l'unica cosa che distingue il primo dal secondo, veniva buttato
 * via perché corto. Qui si prova la casa del segnalante: due frigoriferi, i
 * sensori dell'uno e dell'altro, e il giro completo fino alla temperatura che
 * finisce sulla card.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  eDiQuestoApparecchio,
  eDiUnAltroApparecchio,
  paroleDegliAltri,
  paroleDellApparecchio,
} from "../src/core/entita-di-questo-apparecchio.js";
import { temperatureInfo } from "../src/core/appliance-card-view-model.js";

const CASA = {
  "sensor.frigorifero_1_potenza": {
    state: "82",
    attributes: { device_class: "power", unit_of_measurement: "W" },
  },
  "sensor.frigorifero_2_temperatura": {
    state: "7.4",
    attributes: { device_class: "temperature", unit_of_measurement: "°C" },
  },
  "sensor.frigorifero_1_temperatura": {
    state: "4.1",
    attributes: { device_class: "temperature", unit_of_measurement: "°C" },
  },
  "switch.presa_frigorifero_2": { state: "on", attributes: {} },
  "sensor.shelly_em_channel_1_power": {
    state: "82",
    attributes: { device_class: "power", unit_of_measurement: "W" },
  },
};

const UNO = { id: "appliance-frigo-1", name: "Frigorifero 1", visual_key: "frigo" };
const DUE = { id: "appliance-frigo-2", name: "Frigorifero 2", visual_key: "frigo" };

test("il tipo non fa da nome: «frigo» ce l'hanno tutti i frigoriferi", () => {
  assert.deepEqual(paroleDellApparecchio(UNO), ["frigorifero", "1"]);
  assert.deepEqual(paroleDellApparecchio(DUE), ["frigorifero", "2"]);
});

test("le parole devono combaciare tutte: il numero distingue il primo dal secondo", () => {
  const parole = paroleDellApparecchio(UNO);
  assert.equal(eDiQuestoApparecchio("sensor.frigorifero_1_temperatura", parole), true);
  assert.equal(eDiQuestoApparecchio("sensor.frigorifero_2_temperatura", parole), false);
  assert.equal(eDiQuestoApparecchio("switch.presa_frigorifero_2", parole), false);
});

test("un'entità che porta il nome dell'altro apparecchio è dell'altro, e se ne va", () => {
  const parole = paroleDellApparecchio(UNO);
  const altrui = paroleDegliAltri(UNO, [UNO, DUE]);
  assert.equal(eDiUnAltroApparecchio("sensor.frigorifero_2_temperatura", parole, altrui), true);
  assert.equal(eDiUnAltroApparecchio("switch.presa_frigorifero_2", parole, altrui), true);
  /* Lo shelly em non porta il nome di nessuno dei due: non saperlo attribuire
   * non è una prova che sia nel posto sbagliato, e resta dov'è. */
  assert.equal(eDiUnAltroApparecchio("sensor.shelly_em_channel_1_power", parole, altrui), false);
});

test("«Frigo» e «Frigo 2»: vince chi riconosce l'entità con più parole", () => {
  const corto = { id: "a", name: "Frigo" };
  const lungo = { id: "b", name: "Frigo 2" };
  const paroleCorto = paroleDellApparecchio(corto);
  const altruiCorto = paroleDegliAltri(corto, [corto, lungo]);
  /* Le parole di «Frigo» ci sono tutte anche in `frigo_2_temperatura`: senza
   * il confronto sarebbe sua. Con il confronto è di chi ne ha una in più. */
  assert.equal(eDiQuestoApparecchio("sensor.frigo_2_temperatura", paroleCorto), true);
  assert.equal(eDiUnAltroApparecchio("sensor.frigo_2_temperatura", paroleCorto, altruiCorto), true);
  assert.equal(eDiUnAltroApparecchio("sensor.frigo_temperatura", paroleCorto, altruiCorto), false);
});

test("la passata sui contratti non porta più la presa e il termometro dell'altro", async () => {
  const sezioni = {
    appliances: [
      { ...UNO, entities: [], metadata: {} },
      { ...DUE, entities: [], metadata: {} },
    ],
    loads: [],
    rooms: [],
  };
  globalThis.STATES = CASA;
  globalThis.DashboardModernModules = {
    store: {
      getSection: (nome) => sezioni[nome],
      replaceSection: async (nome, valore) => {
        sezioni[nome] = valore;
        return true;
      },
    },
  };
  const { applyDataContracts } = await import("../src/sections/data-contracts-section.js");
  await applyDataContracts();

  const [uno, due] = sezioni.appliances;
  assert.deepEqual(uno.entities.toSorted(), [
    "sensor.frigorifero_1_potenza",
    "sensor.frigorifero_1_temperatura",
  ]);
  assert.equal(uno.power_entity, "sensor.frigorifero_1_potenza");
  assert.equal(uno.control_entity, "");
  assert.deepEqual(due.entities.toSorted(), [
    "sensor.frigorifero_2_temperatura",
    "switch.presa_frigorifero_2",
  ]);
  assert.equal(due.control_entity, "switch.presa_frigorifero_2");

  /* E la card: la temperatura del frigorifero 1 è la sua, non quella del
   * termometro che sta dentro il frigorifero 2. */
  assert.equal(temperatureInfo(uno, CASA).value, 4.1);
  assert.equal(temperatureInfo(due, CASA).value, 7.4);
});

test("l'associazione sbagliata già in configurazione se ne va da sola", async () => {
  /* La casa del segnalante come è adesso: il frigorifero 1 si è già preso, da
   * una versione di prima, la presa e il termometro del frigorifero 2. */
  const sezioni = {
    appliances: [
      {
        ...UNO,
        entities: [
          "sensor.frigorifero_1_potenza",
          "sensor.frigorifero_2_temperatura",
          "switch.presa_frigorifero_2",
          "sensor.shelly_em_channel_1_power",
        ],
        control_entity: "switch.presa_frigorifero_2",
        power_entity: "sensor.frigorifero_1_potenza",
        metadata: {},
      },
      { ...DUE, entities: [], metadata: {} },
    ],
    loads: [],
    rooms: [],
  };
  globalThis.STATES = CASA;
  globalThis.DashboardModernModules = {
    store: {
      getSection: (nome) => sezioni[nome],
      replaceSection: async (nome, valore) => {
        sezioni[nome] = valore;
        return true;
      },
    },
  };
  const { applyDataContracts } = await import("../src/sections/data-contracts-section.js");
  await applyDataContracts();

  const uno = sezioni.appliances[0];
  assert.equal(uno.entities.includes("switch.presa_frigorifero_2"), false);
  assert.equal(uno.entities.includes("sensor.frigorifero_2_temperatura"), false);
  assert.equal(uno.control_entity, "");
  /* Quello che non si sa di chi sia non si tocca: era già lì, resta lì. */
  assert.equal(uno.entities.includes("sensor.shelly_em_channel_1_power"), true);
  assert.equal(temperatureInfo(uno, CASA).value, 4.1);
});

test("cancellata dalla maschera, l'associazione non torna", async () => {
  /* «Anche se cancello l'associazione, quando ritorno in configurazione me la
   * ritrovo sempre la presa smart incriminata.» La maschera adesso lascia il
   * segno `dm_campi_scelti`, e da lì in poi una casella vuota è una risposta:
   * la passata che indovina non ci torna sopra. */
  const sezioni = {
    appliances: [
      {
        ...UNO,
        entities: ["sensor.frigorifero_1_potenza"],
        control_entity: "",
        power_entity: "sensor.frigorifero_1_potenza",
        metadata: { dm_campi_scelti: true },
      },
    ],
    loads: [],
    rooms: [],
  };
  /* Nella casa c'è un interruttore che porta il suo nome: senza il segno se lo
   * riprenderebbe come comando un istante dopo il salvataggio. */
  globalThis.STATES = { ...CASA, "switch.frigorifero_1_presa": { state: "on", attributes: {} } };
  globalThis.DashboardModernModules = {
    store: {
      getSection: (nome) => sezioni[nome],
      replaceSection: async (nome, valore) => {
        sezioni[nome] = valore;
        return true;
      },
    },
  };
  const { applyDataContracts } = await import("../src/sections/data-contracts-section.js");
  await applyDataContracts();

  const uno = sezioni.appliances[0];
  assert.equal(uno.control_entity, "");
  assert.deepEqual(uno.entities, ["sensor.frigorifero_1_potenza"]);
});

test("la maschera degli elettrodomestici lascia il segno, e non porta avanti l'altrui", async () => {
  const editor = await readFile(
    new URL("../src/sections/appliance-editor-section.js", import.meta.url),
    "utf8",
  );
  /* Il segno è lo stesso che mette il collegamento a un dispositivo: uno solo,
   * non un secondo con un altro nome. */
  assert.match(editor, /import \{ CAMPI_SCELTI \} from "\.\.\/core\/energy-loads-config\.js";/);
  assert.match(
    editor,
    /next\.metadata = \{ \.\.\.\(next\.metadata \|\| \{\}\), \[CAMPI_SCELTI\]: true \};/,
  );
  /* E l'elenco che si porta dietro passa dal setaccio: quello che è di un altro
   * apparecchio non deve restare congelato lì dentro per sempre. */
  assert.match(editor, /normalizeEntities\(device, next, appliances\(\)\)/);
  assert.match(editor, /!eDiUnAltroApparecchio\(entity, parole, altrui\)/);
});

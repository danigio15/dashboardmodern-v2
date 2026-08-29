/* «E' un contatore totale?» — una domanda, una risposta.
 *
 * Da questa risposta dipende tutto il calcolo dell'energia: si parte da un
 * contatore che sale e non torna mai indietro, e giorno, mese e anno si
 * ricavano dalla differenza fra due letture. Sbagliare a riconoscerlo non
 * storce i numeri: li sostituisce con altri.
 *
 * La domanda era scritta due volte, in due moduli, con lo stesso nome e regole
 * diverse. Ognuna aveva ragione su una meta', e ogni meta' sbagliata era un
 * modo di far uscire numeri finti. Questa prova tiene i quattro casi in cui le
 * due copie si contraddicevano: sono la ragione per cui ne e' rimasta una.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { isCumulativeEnergyEntity } from "../src/core/period-service.js";
import { isCumulativeEnergyEntity as dallaProiezione } from "../src/core/energy-projection.js";

const stato = (attributi) => ({ attributes: attributi });

test("le due porte danno sulla stessa stanza", () => {
  assert.equal(dallaProiezione, isCumulativeEnergyEntity);
});

/* Un sensore di potenza si chiama spesso «total power», ma i watt dicono
 * quanto sta consumando adesso, non quanto ha consumato: prenderne la
 * differenza fra due letture e chiamarla energia da' un numero inventato. */
test("i watt non sono un contatore, nemmeno se si chiamano total", () => {
  const stati = { "sensor.total_power": stato({ unit_of_measurement: "W", device_class: "power" }) };
  assert.equal(isCumulativeEnergyEntity("sensor.total_power", stati), false);
});

/* E nemmeno l'acqua: un contatore c'e', ma non e' della corrente. */
test("un contatore dell'acqua non e' un contatore dell'energia", () => {
  const stati = {
    "sensor.acqua_totale": stato({
      unit_of_measurement: "L",
      device_class: "water",
      state_class: "total_increasing",
    }),
  };
  assert.equal(isCumulativeEnergyEntity("sensor.acqua_totale", stati), false);
});

/* «Counter» e' come si chiama meta' dei contatori in giro, e prima una delle
 * due copie non conosceva la parola. */
test("un counter in kilowattora e' un contatore", () => {
  const stati = {
    "sensor.energy_counter": stato({ unit_of_measurement: "kWh", device_class: "energy" }),
  };
  assert.equal(isCumulativeEnergyEntity("sensor.energy_counter", stati), true);
});

/* Il nome tecnico spesso non dice niente — `sensor.dm_0154` — e quello che si
 * legge in casa e' il nome amichevole. */
test("il nome amichevole vale quanto l'identificativo", () => {
  const stati = {
    "sensor.dm_0154": stato({
      unit_of_measurement: "kWh",
      device_class: "energy",
      friendly_name: "Contatore energia casa",
    }),
  };
  assert.equal(isCumulativeEnergyEntity("sensor.dm_0154", stati), true);
});

/* Le cose che gia' funzionavano e devono continuare. */
test("state_class total_increasing basta da solo", () => {
  const stati = {
    "sensor.rete": stato({ unit_of_measurement: "kWh", state_class: "total_increasing" }),
  };
  assert.equal(isCumulativeEnergyEntity("sensor.rete", stati), true);
});

test("un sensore di periodo non e' un contatore", () => {
  const stati = {
    "sensor.energy_month": stato({
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
    }),
  };
  assert.equal(isCumulativeEnergyEntity("sensor.energy_month", stati), false);
});

/* All'avvio la casa e' ancora vuota: rifiutare un'entita' di cui non e'
 * arrivato nessun attributo vorrebbe dire aprire la plancia con l'energia in
 * bianco, e poi vederla comparire. */
test("senza attributi si crede al nome, invece di dire di no", () => {
  assert.equal(isCumulativeEnergyEntity("sensor.solarman_total_grid_energy"), true);
  assert.equal(isCumulativeEnergyEntity("sensor.lavatrice_oggi"), false);
});

test("una casella vuota non e' un contatore", () => {
  assert.equal(isCumulativeEnergyEntity(""), false);
  assert.equal(isCumulativeEnergyEntity(null), false);
});

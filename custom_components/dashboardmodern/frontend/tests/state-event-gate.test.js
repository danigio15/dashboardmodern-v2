import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import { installStateEventGate } from "../src/core/state-event-gate.js";

function harness(delay = 0, sections = null, storageValues = {}) {
  const events = [];
  const ascolti = new Map();
  const letture = { getState: 0 };
  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const root = {
    CustomEvent: FakeCustomEvent,
    addEventListener(tipo, handler) {
      if (!ascolti.has(tipo)) ascolti.set(tipo, []);
      ascolti.get(tipo).push(handler);
    },
    dispatchEvent(event) {
      events.push(event);
      for (const handler of ascolti.get(event?.type) || []) handler(event);
      return true;
    },
    localStorage: {
      getItem(key) {
        return Object.hasOwn(storageValues, key) ? storageValues[key] : null;
      },
      setItem(key, value) {
        storageValues[key] = String(value);
      },
      removeItem(key) {
        delete storageValues[key];
      },
    },
    setTimeout,
    queueMicrotask,
  };
  const sezioni = { valore: sections };
  if (sections) {
    root.DashboardModernModules = {
      store: {
        getState: () => {
          letture.getState += 1;
          return { sections: sezioni.valore };
        },
      },
    };
  }
  const states = new Map();
  const broker = {
    statesStarted: true,
    subscription: 0,
    /* Come il broker vero: l'istantanea si ingerisce con `emitEvent: false`
     * e non fa rumore; e' un evento vivo che passa dal cancello. */
    ingestState(state, { emitEvent = true } = {}) {
      states.set(state.entity_id, state);
      if (!emitEvent) return true;
      root.dispatchEvent(new FakeCustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: state.entity_id, state },
      }));
      return true;
    },
  };
  installStateEventGate(broker, root, { delay, chiavi: CONFIG_KEYS });
  return { broker, events, states, root, sezioni, letture, storageValues };
}

test("initial get_states snapshot updates registries without flooding the UI", async () => {
  const { broker, events, states } = harness();
  for (let index = 0; index < 2500; index += 1) {
    broker.ingestState(
      { entity_id: `sensor.bootstrap_${index}`, state: String(index), attributes: {} },
      { emitEvent: false },
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(states.size, 2500);
  assert.equal(events.length, 0);
});

test("live state changes are coalesced into one UI notification batch", async () => {
  const { broker, events, states } = harness(1);
  broker.subscription = 42;
  for (let index = 0; index < 500; index += 1) {
    broker.ingestState({ entity_id: `sensor.live_${index}`, state: String(index), attributes: {} });
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(states.size, 500);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "dashboardmodern:state-changed");
  assert.equal(events[0].detail.coalesced, true);
  assert.equal(events[0].detail.entity_ids.length, 500);
});

test("unconfigured Home Assistant chatter is stored but not sent to dashboard renderers", async () => {
  const { broker, events, states } = harness(1, {
    energy: { house: { total_energy: "sensor.house_total" } },
    appliances: [{ power_entity: "sensor.microwave_power", control_entity: "switch.microwave" }],
  });
  broker.subscription = 42;
  for (let index = 0; index < 500; index += 1) {
    broker.ingestState({ entity_id: `sensor.unrelated_${index}`, state: String(index), attributes: {} });
  }
  broker.ingestState({ entity_id: "sensor.house_total", state: "123.4", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(states.size, 501);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].detail.entity_ids, ["sensor.house_total"]);
});

test("legacy EV profile entities survive the global live-state filter", async () => {
  const legacyCars = JSON.stringify([
    {
      name: "B10",
      ov: {
        "dm.ev_soc": "sensor.leapmotor_b10_battery",
        "dm.ev_range": "sensor.leapmotor_b10_range",
      },
    },
  ]);
  const { broker, events, states } = harness(
    1,
    { energy: { house: { total_energy: "sensor.house_total" } } },
    { cd_ev_cars: legacyCars },
  );
  broker.subscription = 42;
  broker.ingestState({ entity_id: "sensor.unrelated", state: "1", attributes: {} });
  broker.ingestState({ entity_id: "sensor.leapmotor_b10_battery", state: "80", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(states.size, 2);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].detail.entity_ids, ["sensor.leapmotor_b10_battery"]);
});

/* ── l'elenco delle entita' configurate non si rifa' a orologio ──────────── */

/* Prima si rileggeva tutto ogni cinque secondi finche' gli eventi scorrevano:
 * venti chiavi dal deposito, venti JSON.parse e tutto lo stato del negozio
 * ricamminato, per scoprire quasi sempre che non era cambiato niente. */
test("l'elenco si calcola una volta e non lo rifa' il passare del tempo", async () => {
  const { broker, letture } = harness(1, {
    energy: { house: { total_energy: "sensor.house_total" } },
  });
  broker.subscription = 42;
  const orologio = Date.now;
  try {
    for (let giro = 0; giro < 5; giro += 1) {
      /* Un minuto per giro: col vecchio conto alla rovescia sarebbero state
       * cinque riletture complete. */
      Date.now = () => orologio() + (giro + 1) * 60_000;
      broker.ingestState({ entity_id: "sensor.house_total", state: String(giro), attributes: {} });
      broker.ingestState({ entity_id: `sensor.altro_${giro}`, state: "1", attributes: {} });
    }
  } finally {
    Date.now = orologio;
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(letture.getState, 1, "la configurazione si e' riletta piu' di una volta");
});

test("un salvataggio annunciato dal negozio rifa' l'elenco", async () => {
  const { broker, events, root, sezioni, letture } = harness(1, {
    energy: { house: { total_energy: "sensor.house_total" } },
  });
  broker.subscription = 42;
  broker.ingestState({ entity_id: "sensor.nuovo", state: "1", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(events.length, 0, "non e' ancora configurata: giustamente scartata");

  /* L'utente la configura: il negozio lo annuncia, e da li' in poi quella
   * entita' e' roba nostra. */
  sezioni.valore = {
    energy: { house: { total_energy: "sensor.house_total" } },
    ups: [{ entity: "sensor.nuovo" }],
  };
  root.dispatchEvent({ type: "dashboardmodern:store-user-write", detail: {} });
  broker.ingestState({ entity_id: "sensor.nuovo", state: "2", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(
    events.filter((evento) => evento.type === "dashboardmodern:state-changed").at(-1).detail
      .entity_ids,
    ["sensor.nuovo"],
  );
  assert.equal(letture.getState, 2, "una rilettura sola per il salvataggio");
});

/* E chi non annuncia niente: i gruppi di continuita', le allerte, i rifiuti e
 * il guscio storico scrivono la loro chiave e basta. La scrittura e' l'unica
 * porta, e questa e' la prova che il cancello la guarda. */
test("una chiave di configurazione scritta a mano rifa' l'elenco", async () => {
  const { broker, events, root } = harness(
    1,
    { energy: { house: { total_energy: "sensor.house_total" } } },
    { cd_ups: JSON.stringify([]) },
  );
  broker.subscription = 42;
  broker.ingestState({ entity_id: "sensor.gruppo_continuita", state: "1", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(events.length, 0);

  root.localStorage.setItem(
    "cd_ups",
    JSON.stringify([{ entity: "sensor.gruppo_continuita", nome: "Gruppo" }]),
  );
  broker.ingestState({ entity_id: "sensor.gruppo_continuita", state: "2", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(events.at(-1).detail.entity_ids, ["sensor.gruppo_continuita"]);

  /* E l'azzeramento della configurazione, che le chiavi le toglie: quella
   * entita' torna a essere una qualunque, e non arriva piu' niente. */
  const quanti = events.length;
  root.localStorage.removeItem("cd_ups");
  broker.ingestState({ entity_id: "sensor.gruppo_continuita", state: "3", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(events.length, quanti);
});

test("una chiave che non e' configurazione non fa rifare niente", async () => {
  const { broker, root, letture } = harness(1, {
    energy: { house: { total_energy: "sensor.house_total" } },
  });
  broker.subscription = 42;
  broker.ingestState({ entity_id: "sensor.house_total", state: "1", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(letture.getState, 1);
  /* La plancia scrive di continuo cose che non sono configurazione — la
   * bandierina della sincronizzazione, l'ora dell'ultimo salvataggio. */
  root.localStorage.setItem("cd_sync_ts", String(Date.now()));
  broker.ingestState({ entity_id: "sensor.house_total", state: "2", attributes: {} });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(letture.getState, 1, "una scrittura qualunque ha rifatto l'elenco");
});

import assert from "node:assert/strict";
import test from "node:test";
import { installStateEventGate } from "../src/core/state-event-gate.js";

function harness(delay = 0, sections = null, storageValues = {}) {
  const events = [];
  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const root = {
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    localStorage: {
      getItem(key) {
        return Object.hasOwn(storageValues, key) ? storageValues[key] : null;
      },
    },
    setTimeout,
    queueMicrotask,
  };
  if (sections) {
    root.DashboardModernModules = {
      store: {
        getState: () => ({ sections }),
      },
    };
  }
  const states = new Map();
  const broker = {
    statesStarted: true,
    subscription: 0,
    ingestState(state) {
      states.set(state.entity_id, state);
      root.dispatchEvent(new FakeCustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: state.entity_id, state },
      }));
      return true;
    },
  };
  installStateEventGate(broker, root, { delay });
  return { broker, events, states };
}

test("initial get_states snapshot updates registries without flooding the UI", async () => {
  const { broker, events, states } = harness();
  for (let index = 0; index < 2500; index += 1) {
    broker.ingestState({ entity_id: `sensor.bootstrap_${index}`, state: String(index), attributes: {} });
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

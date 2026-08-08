import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HomeAssistantBroker,
  periodConsumption,
  recorderBucketConsumptions,
  sourcePlans,
} from "../src/core/period-service.js";

const fixture = JSON.parse(await readFile(new URL("fixtures/ha-recorder-energy.json", import.meta.url)));

test("DashboardModern equals Home Assistant Energy for reset-aware Recorder sum growth", () => {
  const value = periodConsumption(fixture.rows, fixture.baseline);
  assert.ok(Math.abs(value - fixture.home_assistant_energy) < 1e-9);
  assert.equal(value, fixture.rows.at(-1).sum - fixture.baseline.sum);
});

test("daily chart buckets use the same Recorder sum growth as the period total", () => {
  const buckets = recorderBucketConsumptions(fixture.rows, fixture.baseline);
  const total = buckets.reduce((sum, row) => sum + row.change, 0);
  assert.ok(Math.abs(total - fixture.home_assistant_energy) < 1e-9);
  assert.ok(buckets.every((row) => row.change >= 0));
});

test("a missing sample at the initial boundary uses only the preceding baseline", () => {
  const baseline = { start: "2026-07-31T23:00:00Z", sum: 100 };
  const rows = [{ start: "2026-08-01T00:17:00Z", sum: 101.25 }, { start: "2026-08-01T01:17:00Z", sum: 103.5 }];
  assert.equal(periodConsumption(rows, baseline), 3.5);
});

test("an incomplete current month uses its latest Recorder sum", () => {
  const baseline = { start: "2026-07-31T23:00:00Z", sum: 500 };
  const partial = [{ start: "2026-08-06T18:00:00Z", sum: 527.4 }];
  assert.ok(Math.abs(periodConsumption(partial, baseline) - 27.4) < 1e-9);
});

test("incompatible or unavailable rows never fall back to state or max", () => {
  assert.equal(periodConsumption([{ state: 10, max: 10 }], { state: 2, max: 2 }), null);
  assert.equal(periodConsumption([{ sum: "unavailable" }], { sum: 2 }), null);
});

test("period sensors keep the cumulative total as historical fallback", async () => {
  const states = {
    "sensor.house_month": {
      state: "12.4",
      attributes: { unit_of_measurement: "kWh", state_class: "measurement" },
    },
    "sensor.house_total": {
      state: "530",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
  };
  const plans = sourcePlans(
    { house: { monthly_energy: "sensor.house_month", total_energy: "sensor.house_total" } },
    "month",
    states,
  ).filter((plan) => plan.key === "house");
  assert.equal(plans.length, 2);
  assert.equal(plans[0].direct, true);
  assert.equal(plans[1].fallback, true);
  assert.equal(plans[1].entity, "sensor.house_total");

  const broker = new HomeAssistantBroker();
  broker.statistics = async () => ({
    "sensor.house_total": [
      { start: "2025-05-31T12:00:00.000Z", sum: 100 },
      { start: "2025-06-15T12:00:00.000Z", sum: 118 },
      { start: "2025-06-30T12:00:00.000Z", sum: 130 },
    ],
  });
  const values = await broker.valuesForPlans(plans, new Date(2025, 5, 1), states);
  assert.equal(values.get("house"), 30);
});

test("live Home Assistant states emit refresh events but derived period states do not", () => {
  const broker = new HomeAssistantBroker();
  const previousDispatch = globalThis.dispatchEvent;
  const previousCustomEvent = globalThis.CustomEvent;
  const events = [];
  class TestCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  globalThis.CustomEvent = TestCustomEvent;
  globalThis.dispatchEvent = (event) => {
    events.push(event);
    return true;
  };
  try {
    broker.ingestState({ entity_id: "sensor.house_power", state: "400", attributes: {} });
    broker.ingestState({
      entity_id: "dm.energy_consumo_casa_mese",
      state: "20",
      attributes: { dashboardmodern_derived: true },
    });
  } finally {
    globalThis.dispatchEvent = previousDispatch;
    globalThis.CustomEvent = previousCustomEvent;
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "dashboardmodern:state-changed");
  assert.equal(events[0].detail.entity_id, "sensor.house_power");
});

test("initial Home Assistant snapshot is silent while later subscription events remain live", async () => {
  const broker = new HomeAssistantBroker({ timeout: 1000 });
  const previousDispatch = globalThis.dispatchEvent;
  const previousCustomEvent = globalThis.CustomEvent;
  const previousStates = globalThis.STATES;
  const previousRawStates = globalThis._RAW_STATES;
  const events = [];
  class TestCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  globalThis.CustomEvent = TestCustomEvent;
  globalThis.dispatchEvent = (event) => {
    events.push(event);
    return true;
  };
  globalThis.STATES = {};
  globalThis._RAW_STATES = {};

  broker.cachedRequest = async (payload) => {
    assert.equal(payload.type, "get_states");
    return [{ entity_id: "sensor.house_power", state: "400", attributes: {} }];
  };
  let subscriptionRequest = null;
  const socket = {
    send(raw) {
      subscriptionRequest = JSON.parse(raw);
      queueMicrotask(() => {
        broker.handleMessage(
          JSON.stringify({
            type: "result",
            id: subscriptionRequest.id,
            success: true,
            result: null,
          }),
          () => {},
          () => {},
        );
      });
    },
  };
  broker.connect = async () => socket;

  try {
    await broker.startStateFeed();
    assert.equal(globalThis.STATES["sensor.house_power"].state, "400");
    assert.equal(globalThis._RAW_STATES["sensor.house_power"].state, "400");
    assert.equal(events.length, 0);
    assert.equal(subscriptionRequest.type, "subscribe_events");
    assert.equal(subscriptionRequest.event_type, "state_changed");

    broker.handleMessage(
      JSON.stringify({
        type: "event",
        id: broker.subscription,
        event: {
          data: {
            new_state: { entity_id: "sensor.house_power", state: "401", attributes: {} },
          },
        },
      }),
      () => {},
      () => {},
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "dashboardmodern:state-changed");
    assert.equal(events[0].detail.entity_id, "sensor.house_power");
    assert.equal(events[0].detail.state.state, "401");
  } finally {
    globalThis.dispatchEvent = previousDispatch;
    globalThis.CustomEvent = previousCustomEvent;
    if (previousStates === undefined) delete globalThis.STATES;
    else globalThis.STATES = previousStates;
    if (previousRawStates === undefined) delete globalThis._RAW_STATES;
    else globalThis._RAW_STATES = previousRawStates;
  }
});

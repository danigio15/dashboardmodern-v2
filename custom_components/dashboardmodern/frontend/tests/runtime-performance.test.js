import assert from "node:assert/strict";
import test from "node:test";
import { HomeAssistantBroker } from "../src/core/period-service.js";
import { createCoalescedUpdater, createRuntimeMetrics } from "../src/core/runtime-metrics.js";

test("rapid updates for the same entity are coalesced into one section refresh", async () => {
  const metrics = createRuntimeMetrics();
  const update = createCoalescedUpdater(() => metrics.increment("energyRefreshes"));
  for (let index = 0; index < 100; index += 1) update("sensor.grid_total");
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(metrics.snapshot(), { recorderRequests: 0, energyRefreshes: 1, applianceRenders: 0, globalRenders: 0 });
});

test("identical concurrent Recorder requests share one in-flight promise", async () => {
  const broker = new HomeAssistantBroker();
  let requests = 0;
  let release;
  broker.request = async () => { requests += 1; return new Promise((resolve) => { release = resolve; }); };
  const args = [["sensor.grid_total"], new Date("2026-08-01T00:00:00Z"), new Date("2026-08-02T00:00:00Z"), "hour"];
  const first = broker.statistics(...args);
  const second = broker.statistics(...args);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(requests, 1);
  release({ "sensor.grid_total": [] });
  assert.deepEqual(await first, await second);
});

test("runtime counters report Recorder, Energy, appliance and global work separately", () => {
  const metrics = createRuntimeMetrics();
  metrics.increment("recorderRequests");
  metrics.increment("energyRefreshes");
  metrics.increment("applianceRenders");
  metrics.increment("globalRenders");
  assert.deepEqual(metrics.snapshot(), { recorderRequests: 1, energyRefreshes: 1, applianceRenders: 1, globalRenders: 1 });
});

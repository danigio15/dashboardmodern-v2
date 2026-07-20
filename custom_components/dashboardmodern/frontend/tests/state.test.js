import assert from "node:assert/strict";
import test from "node:test";
import { DashboardModernStore } from "../src/state.js";

const one = { id: "one", title: "One", views: [], sections: [], cards: [] };
const two = { id: "two", title: "Two", views: [], sections: [], cards: [] };

function makeApi() {
  const calls = [];
  let dashboards = [one, two];
  return {
    calls,
    api: {
      async listDashboards(entryId) { calls.push(["list", entryId]); return dashboards; },
      async getDashboard(entryId, id) { calls.push(["get", entryId, id]); return dashboards.find((item) => item.id === id); },
      async createDashboard(entryId, dashboard) { calls.push(["create", entryId, dashboard]); dashboards = [...dashboards, dashboard]; return dashboard; },
      async replaceDashboard(entryId, dashboard) { calls.push(["replace", entryId, dashboard]); dashboards = dashboards.map((item) => item.id === dashboard.id ? dashboard : item); return dashboard; },
      async deleteDashboard(entryId, id) { calls.push(["delete", entryId, id]); dashboards = dashboards.filter((item) => item.id !== id); return { dashboard_id: id, deleted: true }; },
    },
  };
}

test("initialize tracks loading transitions and loads first dashboard", async () => {
  const { api, calls } = makeApi();
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry-1" });
  const loadingStates = [];
  store.subscribe((state) => loadingStates.push(state.loading));
  await store.initialize();
  assert.deepEqual(calls, [["list", "entry-1"], ["get", "entry-1", "one"]]);
  assert.equal(store.state.activeDashboardId, "one");
  assert.deepEqual(loadingStates, [false, true, true, false, true, false]);
});

test("selected dashboard synchronization preserves selection after replace", async () => {
  const { api } = makeApi();
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry-1" });
  await store.initialize();
  await store.loadDashboard("two");
  await store.replaceDashboard({ ...two, title: "Two updated" });
  assert.equal(store.state.activeDashboardId, "two");
  assert.equal(store.state.activeDashboard.title, "Two updated");
});

test("create and delete keep backend and local list synchronized", async () => {
  const { api } = makeApi();
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry-1" });
  await store.initialize();
  await store.createDashboard({ id: "three", title: "Three", views: [], sections: [], cards: [] });
  assert.equal(store.state.activeDashboardId, "three");
  await store.deleteDashboard("three");
  assert.equal(store.state.activeDashboardId, "one");
  assert.deepEqual(store.state.dashboards.map((item) => item.id), ["one", "two"]);
});

test("errors are captured without throwing", async () => {
  const store = new DashboardModernStore({ listDashboards: async () => { throw { code: "entry_not_loaded" }; } }, { entryIdResolver: async () => "entry-1" });
  await store.initialize();
  assert.equal(store.state.error.code, "entry_not_loaded");
  assert.equal(store.state.loading, false);
});

test("active view is presentation state preserved across refresh and falls back when removed", async () => {
  const dash = { id: "one", title: "One", views: [{ id: "a", title: "A" }, { id: "b", title: "B" }], sections: [], cards: [] };
  const updated = { ...dash, views: [{ id: "a", title: "A" }] };
  let current = dash;
  const calls = [];
  const store = new DashboardModernStore({
    async listDashboards() { return [{ id: "one", title: "One" }]; },
    async getDashboard(entryId, id) { calls.push(["get", id]); return current; },
  }, { entryIdResolver: async () => "entry-1" });
  await store.initialize();
  store.setActiveView("b");
  await store.loadDashboard("one");
  assert.equal(store.state.activeViewId, "b");
  current = updated;
  await store.loadDashboard("one");
  assert.equal(store.state.activeViewId, "a");
  assert.deepEqual(calls, [["get", "one"], ["get", "one"], ["get", "one"]]);
});

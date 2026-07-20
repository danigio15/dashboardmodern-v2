import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardModernClient, DashboardModernApiError } from "../src/ws-client.js";

const dashboard = { id: "main", title: "Main", views: [], sections: [], cards: [] };

function clientFor(handler) {
  const messages = [];
  return {
    messages,
    client: createDashboardModernClient({
      sendMessagePromise(message) {
        messages.push(message);
        return handler(message);
      },
    }),
  };
}

test("list success sends the list command", async () => {
  const { client, messages } = clientFor(() => ({ dashboards: [dashboard] }));
  assert.deepEqual(await client.listDashboards("entry-1"), [dashboard]);
  assert.equal(messages[0].type, "dashboardmodern/dashboard/list");
});

test("get success sends the get command", async () => {
  const { client, messages } = clientFor(() => ({ dashboard }));
  assert.deepEqual(await client.getDashboard("entry-1", "main"), dashboard);
  assert.equal(messages[0].dashboard_id, "main");
});

test("create success sends JSON dashboard payload", async () => {
  const { client, messages } = clientFor(() => ({ dashboard }));
  assert.deepEqual(await client.createDashboard("entry-1", dashboard), dashboard);
  assert.equal(messages[0].type, "dashboardmodern/dashboard/create");
  assert.deepEqual(messages[0].dashboard, dashboard);
});

test("replace success sends JSON dashboard payload", async () => {
  const { client, messages } = clientFor(() => ({ dashboard }));
  assert.deepEqual(await client.replaceDashboard("entry-1", dashboard), dashboard);
  assert.equal(messages[0].type, "dashboardmodern/dashboard/replace");
});

test("delete success validates response", async () => {
  const { client } = clientFor(() => ({ dashboard_id: "main", deleted: true }));
  assert.deepEqual(await client.deleteDashboard("entry-1", "main"), { dashboard_id: "main", deleted: true });
});

test("backend error mapping preserves error code", async () => {
  const { client } = clientFor(() => Promise.reject({ code: "dashboard_not_found", message: "boom" }));
  await assert.rejects(() => client.getDashboard("entry-1", "missing"), (error) => {
    assert.ok(error instanceof DashboardModernApiError);
    assert.equal(error.code, "dashboard_not_found");
    return true;
  });
});

test("invalid response handling rejects malformed payloads", async () => {
  const { client } = clientFor(() => ({ dashboards: "not-an-array" }));
  await assert.rejects(() => client.listDashboards("entry-1"), /invalid response/i);
});

test("client does not access Home Assistant Store, YAML, or Lovelace APIs", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/ws-client.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /Store|lovelace|yaml|entities/i);
});

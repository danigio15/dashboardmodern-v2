import assert from "node:assert/strict";
import test from "node:test";

import {
  applianceReportIcon,
  normalizedToken,
} from "../legacy/release-0149-fixes.js";

const originalHTMLElement = globalThis.HTMLElement;
const originalCustomElements = globalThis.customElements;
if (!globalThis.HTMLElement) globalThis.HTMLElement = class {};
if (!globalThis.customElements) {
  const registry = new Map();
  globalThis.customElements = {
    define: (name, value) => registry.set(name, value),
    get: (name) => registry.get(name),
  };
}

const { ensureCompanionDashboard, userCanAccess } = await import("../panel.js");

test("report icon follows the appliance visual when no report override exists", () => {
  assert.equal(applianceReportIcon({ visual_key: "frigo" }), "mdi:fridge-outline");
  assert.equal(applianceReportIcon({ device_type: "forno" }), "mdi:stove");
  assert.equal(
    applianceReportIcon({ visual_key: "frigo", report_icon: "mdi:snowflake" }),
    "mdi:snowflake",
  );
  assert.equal(normalizedToken("Piano cottura"), "piano_cottura");
});

test("user allow-list is exact and an empty list means every authenticated user", () => {
  assert.equal(userCanAccess({ allowed_user_ids: [] }, { id: "giovanni" }), true);
  assert.equal(
    userCanAccess({ allowed_user_ids: ["giovanni"] }, { id: "giovanni" }),
    true,
  );
  assert.equal(
    userCanAccess({ allowed_user_ids: ["giovanni"] }, { id: "donato" }),
    false,
  );
});

test("admin bootstrap creates a Lovelace dashboard with per-user view visibility", async () => {
  const messages = [];
  const hass = {
    user: { id: "admin", is_admin: true },
    connection: {
      async sendMessagePromise(message) {
        messages.push(structuredClone(message));
        if (message.type === "lovelace/dashboards/list") return [];
        if (message.type === "lovelace/dashboards/create") {
          return { id: "dash-id", url_path: message.url_path, title: message.title };
        }
        return null;
      },
    },
  };
  await ensureCompanionDashboard(hass, {
    config: {
      entry_ids: ["entry-12345678"],
      instance_id: "entry-12345678",
      title: "Casa",
      static_base: "/dashboardmodern_static/hash",
      allowed_user_ids: ["giovanni"],
      register_lovelace_dashboard: true,
      lovelace_url_path: "dashboardmodern-entry123",
      primary: true,
      admin_only: false,
    },
  });

  assert.equal(messages.some((message) => message.type === "lovelace/dashboards/create"), true);
  const save = messages.find((message) => message.type === "lovelace/config/save");
  assert.deepEqual(save.config.views[0].visible, [{ user: "giovanni" }]);
  assert.equal(save.config.views[0].cards[0].type, "custom:dashboardmodern-card");
});

test.after(() => {
  if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
  else globalThis.HTMLElement = originalHTMLElement;
  if (originalCustomElements === undefined) delete globalThis.customElements;
  else globalThis.customElements = originalCustomElements;
});

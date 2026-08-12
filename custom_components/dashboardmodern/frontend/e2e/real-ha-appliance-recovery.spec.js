// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "sensor.frigo_power",
    state: "82",
    attributes: { friendly_name: "Frigo potenza", unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.frigo_energy",
    state: "12.7",
    attributes: {
      friendly_name: "Frigo energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
    },
  },
  {
    entity_id: "switch.frigo",
    state: "on",
    attributes: { friendly_name: "Frigo" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:silverware-fork-knife" }],
    lights: [],
    appliances: [
      {
        id: "appl-frigo",
        name: "Frigo",
        device_type: "frigo",
        visual_type: "asset",
        visual_key: "frigo",
        entities: [],
        room_id: "room-cucina",
        show_in_report: true,
      },
    ],
    loads: [],
    covers: [],
  },
  visibility: { energy: true, appliances: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        const result =
          message.type === "get_states"
            ? haStates
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, states);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(
    (haStates) =>
      haStates.forEach((state) => {
        _RAW_STATES[state.entity_id] = structuredClone(state);
        STATES[state.entity_id] = structuredClone(state);
      }),
    states,
  );
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

test("real HA: recover a saved Frigo with missing power, energy and control entities", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 60_000);
  await boot(page, testInfo);

  await expect
    .poll(() => page.evaluate(() => DashboardModernModules.store.getSection("appliances")[0]))
    .toMatchObject({
      id: "appl-frigo",
      power_entity: "sensor.frigo_power",
      energy_entity: "sensor.frigo_energy",
      report_entity: "sensor.frigo_energy",
      control_entity: "switch.frigo",
      show_in_report: true,
    });

  await page.evaluate(() => {
    apriConfigEntita();
    editorSwitch("sez1");
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.locator(".ed-inner-tab", { hasText: /^REPORT$/i }).click();
  await expect(page.locator("#dm-report-entity-appl-frigo")).toHaveValue("sensor.frigo_energy");

  await page.evaluate(() => {
    cdRebuildReportDevices();
    buildReportSelect();
  });
  await expect(page.locator('#ed-dev-selector option[value="sensor.frigo_energy"]')).toContainText(
    "Frigo",
  );
});

import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "switch.frigo",
    state: "on",
    attributes: { friendly_name: "Frigorifero", device_class: "outlet" },
  },
  {
    entity_id: "sensor.frigo_power",
    state: "42",
    attributes: { friendly_name: "Frigorifero power", unit_of_measurement: "W" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa" }],
    appliances: [
      {
        id: "appliance-fridge",
        name: "Frigorifero",
        device_type: "generico",
        icon: "generico",
        visual_type: "asset",
        visual_key: "generico",
        room_id: "room-salone",
        entities: ["switch.frigo", "sensor.frigo_power"],
        threshold_run: 5,
      },
    ],
    loads: [],
  },
  visibility: { appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = MockSocket.OPEN;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
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
        let result = null;
        if (message.type === "get_states") result = haStates;
        else if (message.type === "frontend/get_user_data") result = { value: null };
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, states);
  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (haStates) => haStates.forEach((item) => {
      _RAW_STATES[item.entity_id] = structuredClone(item);
      STATES[item.entity_id] = structuredClone(item);
    }),
    states,
  );
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Edit shares all 20 blue appliance icons and preserves links`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") test.slow(true, "Full editor flow is slower on WebKit/iPad");
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
      window.edApplEdit(0);
    });

    const modal = page.locator("#dm-appliance-editor-modal");
    await expect(modal).toBeVisible();
    const trigger = modal.locator("[data-type-trigger]");
    await expect(trigger).toContainText(/Frigorifero|Refrigerator/);
    await expect(trigger).not.toContainText(/generico|generic/i);

    // The legacy record contains only `entities`. Edit must recover the actual
    // control and power links from the canonical Home Assistant state registry.
    await expect(modal.locator('input[name="control_entity"]')).toHaveValue("switch.frigo");
    await expect(modal.locator('input[name="power_entity"]')).toHaveValue("sensor.frigo_power");

    // Compare the browser-normalized SVG DOM, not raw HTML source syntax. HTML
    // parsers expand SVG self-closing tags, while cdApplianceIcon() returns the
    // source string; both must still resolve to the exact same rendered SVG.
    const iconParity = await modal.locator("[data-icon-preview]").evaluate((node) => {
      const expectedHost = document.createElement("span");
      expectedHost.innerHTML = window.cdApplianceIcon("frigo", 58);
      return {
        actual: node.querySelector("svg")?.outerHTML || "",
        expected: expectedHost.querySelector("svg")?.outerHTML || "",
      };
    });
    expect(iconParity.actual).toBe(iconParity.expected);

    await trigger.click();
    const picker = page.locator("#dm-applpick");
    await expect(picker).toBeVisible();
    await expect(picker.locator("[data-appliance-type]")).toHaveCount(20);
    for (const type of ["frigo", "congelatore", "ferro", "aspirapolvere", "robot", "tv", "caffe", "bollitore"]) {
      await expect(picker.locator(`[data-appliance-type="${type}"]`)).toHaveCount(1);
    }
    await picker.locator('[data-appliance-type="frigo"]').click();

    await expect(trigger).toContainText(/Frigorifero|Refrigerator/);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toHaveCount(0);

    await expect
      .poll(() => page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem("dm_dashboard_state") || "{}");
        const item = state.sections?.appliances?.[0] || {};
        return {
          visual: item.visual_key,
          type: item.device_type,
          control: item.control_entity,
          power: item.power_entity,
          entities: item.entities,
        };
      }))
      .toEqual({
        visual: "frigo",
        type: "frigo",
        control: "switch.frigo",
        power: "sensor.frigo_power",
        entities: ["switch.frigo", "sensor.frigo_power"],
      });
  });
}

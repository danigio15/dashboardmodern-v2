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

    const iconParity = await modal.locator("[data-icon-preview]").evaluate((node) => ({
      actual: node.innerHTML,
      expected: window.cdApplianceIcon("frigo", 58),
    }));
    expect(iconParity.actual).toBe(iconParity.expected);

    await trigger.click();
    const picker = page.locator("#dm-applpick");
    await expect(picker).toBeVisible();
    await expect(picker.locator("[data-appliance-type]")).toHaveCount(20);
    for (const type of ["frigo", "congelatore", "ferro", "aspirapolvere", "robot", "tv", "caffe", "bollitore"]) {
      await expect(picker.locator(`[data-appliance-type="${type}"]`)).toHaveCount(1);
    }
    const addPickerKeys = await page.evaluate(() => window.DM_APPLIANCES?.map?.((item) => item.t) || []);
    // DM_APPLIANCES is a legacy lexical const and may not be a window property;
    // the runtime picker contract is therefore compared through its actual 20
    // rendered buttons rather than relying on that implementation detail.
    expect(addPickerKeys.length === 0 || addPickerKeys.length === 20).toBe(true);
    await picker.locator('[data-appliance-type="frigo"]').click();

    await expect(trigger).toContainText(/Frigorifero|Refrigerator/);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toHaveCount(0);

    await expect
      .poll(() => page.evaluate(() => {
        const item = DashboardModernModules.store.getSection("appliances")[0];
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

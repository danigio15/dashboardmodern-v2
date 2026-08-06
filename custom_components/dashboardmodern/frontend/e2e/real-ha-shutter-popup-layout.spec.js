import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const state = {
  entity_id: "cover.salone",
  state: "open",
  attributes: { friendly_name: "Tapparella salone", current_position: 65 },
};

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa" }],
    lights: [],
    appliances: [],
    loads: [],
    covers: [{ id: "cover-salone", name: "Tapparella salone", entity: "cover.salone", entities: ["cover.salone"], room_id: "room-salone" }],
  },
  visibility: { home: true, tapparelle: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haState) => {
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
        const result = message.type === "get_states" ? [haState] : message.type === "frontend/get_user_data" ? { value: null } : null;
        this.onmessage?.({ data: JSON.stringify({ id: message.id, type: "result", success: true, result }) });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, state);

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haState) => {
    _RAW_STATES[haState.entity_id] = structuredClone(haState);
    STATES[haState.entity_id] = structuredClone(haState);
  }, state);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => window.render?.());
}

test("real HA: shutter popup keeps close control and three actions aligned", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const alert = page.locator("#tapp-avvisi .dm-shutter-alert");
  await expect(alert).toBeVisible();
  await alert.click();

  const popup = page.locator("#dm-shutter-popup");
  const title = popup.locator(".ev-waw-title");
  const close = popup.locator("[data-shutter-popup-close]");
  const actions = popup.locator(".dm-shutter-actions button");
  await expect(popup).toBeVisible();
  await expect(title).toBeVisible();
  await expect(close).toBeVisible();
  await expect(actions).toHaveCount(3);

  const [titleBox, closeBox] = await Promise.all([title.boundingBox(), close.boundingBox()]);
  if (!titleBox || !closeBox) throw new Error("Shutter popup header has no bounding box");
  expect(Math.abs((titleBox.y + titleBox.height / 2) - (closeBox.y + closeBox.height / 2))).toBeLessThanOrEqual(8);
  expect(closeBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);

  const widths = await actions.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  for (const width of widths) expect(width).toBeGreaterThan(60);

  await page.screenshot({ path: `test-results/${testInfo.project.name}-real-ha-shutter-popup-layout.png` });
});

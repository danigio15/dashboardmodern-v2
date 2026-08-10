import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-1", name: "Cameretta", icon: "mdi:sofa", floor: "" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "ev-pluto", name: "Pluto", brand: "Leapmotor", icon: "mdi:car-electric", ov: {} }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }

      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() => this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        }));
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }

    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true)).toBe(true);
}

async function switchEditor(page, tab) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.evaluate((target) => editorSwitch(target), tab);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: car appearance exists only in EV and brand/model controls are dedicated`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await switchEditor(page, "sez0");
    await expect(page.locator("#ed-body [data-ev-appearance]")).toHaveCount(0);

    await switchEditor(page, "sez2");
    const appearance = page.locator("#ed-body [data-ev-appearance]");
    await expect(appearance).toHaveCount(1);
    await expect(appearance).toBeVisible();

    await appearance.locator("[data-brand-preview]").click();
    const brandPicker = page.locator('#dm-visual-picker[data-kind="car"]');
    await expect(brandPicker).toBeVisible();
    await expect(brandPicker.locator(".dm-car-brand").first()).toBeVisible();
    const leap = brandPicker.locator(".dm-picker-option", { hasText: "Leapmotor" });
    await expect(leap.locator('.dm-leapmotor-mark[data-brand="leapmotor"][data-brand-source="inline"]')).toHaveCount(1);
    await brandPicker.locator("[data-close]").click();

    await expect(appearance.locator("[data-icon-preview]")).toHaveCount(0);
    await expect(page.locator('#dm-visual-picker[data-kind="car-icon"]')).toHaveCount(0);
    const modelSelect = appearance.locator("select[data-model]");
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect).toContainText("T03");
    await expect(modelSelect).toContainText("B10");
    await expect(modelSelect).toContainText("C10");
    await modelSelect.selectOption("B10");
    await expect(appearance.locator("[data-brand-preview]")).toContainText("B10");

    await switchEditor(page, "sez0");
    await expect(page.locator("#ed-body [data-ev-appearance]")).toHaveCount(0);
  });
}

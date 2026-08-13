// DM-FIX-20260813C
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room_cameretta", name: "Cameretta", icon: "mdi:bed-king-outline" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, temp: true, temperature: true },
};

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
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
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: message.id,
              type: "result",
              success: true,
              result: message.type === "get_states" ? [] : null,
            }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
    window.matchMedia = (query) => ({
      matches: !query.includes("pointer:fine"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      },
    });
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
}

async function assertStablePicker(page, kind, glyph) {
  const picker = page.locator(`#dm-visual-picker[data-kind="${kind}"]`);
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-dm-icon-engine", "single-owner");
  await expect(picker.locator("svg,ha-icon")).toHaveCount(0);
  await expect(picker.locator("[data-search]")).not.toBeFocused();
  const first = picker.locator('.dm-picker-option[data-index="0"] .dm-picker-visual');
  await expect(first).toHaveAttribute("data-dm-icon-engine-glyph-value", glyph);

  const before = await first.evaluate((node) => ({
    text: getComputedStyle(node, "::before").content,
    glyph: node.dataset.dmIconEngineGlyphValue,
  }));
  await page.waitForTimeout(1250);
  await expect(picker.locator("svg,ha-icon")).toHaveCount(0);
  await expect(first).toHaveAttribute("data-dm-icon-engine-glyph-value", glyph);
  const after = await first.evaluate((node) => ({
    text: getComputedStyle(node, "::before").content,
    glyph: node.dataset.dmIconEngineGlyphValue,
  }));
  expect(after).toEqual(before);
}

test("beta18: action and room pickers remain visually stable beyond former delayed repairs", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 80_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:lightbulb" }]),
    );
    buildQuickActions();
  });

  await openEditor(page, "sez8");
  await page.locator('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index="0"]').click();
  const actionPreview = page.locator("#dm-action-editor-modal [data-action-icon-preview]");
  await expect(actionPreview).toHaveAttribute("data-dm-icon-engine-glyph-value", "💡");
  await expect(actionPreview.locator("svg,ha-icon")).toHaveCount(0);
  await actionPreview.click();
  await assertStablePicker(page, "action", "🏠");
  await page.locator("#dm-visual-picker [data-close]").click();

  await page.locator("#dm-action-editor-modal [data-close]").click();
  await openEditor(page, "stanze");
  await page.locator("#ed-body .dm-beta5-room-icon-trigger").click();
  await assertStablePicker(page, "room", "🛋️");
});

test("beta18: first-add Quick Action trigger uses the same picker without keyboard autofocus", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 80_000);
  await boot(page, testInfo);
  await openEditor(page, "sez8");
  const trigger = page.locator("#ed-body .dm-beta6-qa-icon-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await assertStablePicker(page, "action", "🏠");
});

// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const state = {
  entity_id: "cover.salone",
  state: "open",
  attributes: {
    friendly_name: "Tapparella salone",
    current_position: 65,
    icon: "mdi:window-shutter",
  },
};

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa" }],
    lights: [],
    appliances: [],
    loads: [],
    covers: [
      {
        id: "cover-salone",
        name: "Tapparella salone",
        entity: "cover.salone",
        entities: ["cover.salone"],
        room_id: "room-salone",
        icon: "mdi:window-shutter",
      },
    ],
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
        const result =
          message.type === "get_states"
            ? [haState]
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
  }, state);

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haState) => {
    _RAW_STATES[haState.entity_id] = structuredClone(haState);
    STATES[haState.entity_id] = structuredClone(haState);
  }, state);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => window.render?.());
}

test("real HA: shutter popup uses the compact shared modal contract", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const alert = page.locator("#tapp-avvisi .dm-shutter-alert");
  await expect(alert).toBeVisible();
  await alert.click();

  const popup = page.locator("#dm-shutter-popup");
  const card = popup.locator(".dm-shutter-popup-card");
  const title = popup.locator(".ev-waw-title");
  const titleIcon = popup.locator(".dm-shutter-title-icon");
  const close = popup.locator("[data-shutter-popup-close]");
  const rowIcon = popup.locator(".dm-shutter-row-icon").first();
  const actions = popup.locator(".dm-shutter-actions button");

  await expect(popup).toBeVisible();
  await expect(card).toBeVisible();
  await expect(title).toBeVisible();
  await expect(titleIcon).toBeVisible();
  await expect(rowIcon).toBeVisible();
  await expect(close).toBeVisible();
  /* Quattro tasti nel DOM: Apri, Ferma, Chiudi e il preset della posizione
   * preferita (#200), che senza una posizione configurata resta nascosto —
   * la riga visibile deve dire tre comandi, non quattro. */
  await expect(actions).toHaveCount(4);
  await expect(popup.locator(".dm-shutter-actions .dm-shutter-preset").first()).toBeHidden();
  await expect(actions.locator("visible=true")).toHaveCount(3);

  const [titleBox, closeBox, cardBox] = await Promise.all([
    title.boundingBox(),
    close.boundingBox(),
    card.boundingBox(),
  ]);
  if (!titleBox || !closeBox || !cardBox) throw new Error("Shutter popup has no bounding box");
  expect(
    Math.abs(titleBox.y + titleBox.height / 2 - (closeBox.y + closeBox.height / 2)),
  ).toBeLessThanOrEqual(8);
  expect(closeBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
  expect(cardBox.width).toBeLessThanOrEqual(
    Math.min(682, testInfo.project.name === "mobile" ? 480 : 682),
  );

  const boxes = await actions.evaluateAll((buttons) =>
    buttons
      .filter((button) => !button.hidden)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
  );
  expect(
    Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width)),
  ).toBeLessThanOrEqual(2);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(60);
    expect(box.height).toBeLessThanOrEqual(48);
  }

  await expect(popup.locator(".dm-shutter-details .d-state")).toContainText(/Salone.*Aperta.*65%/i);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-real-ha-shutter-popup-layout.png`,
  });
});

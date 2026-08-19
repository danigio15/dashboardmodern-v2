// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    appliances: [],
    loads: [],
    covers: [],
    lights: [],
  },
  visibility: { energy: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockSocket extends EventTarget {
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
        this.onmessage?.({
          data: JSON.stringify({
            id: message.id,
            type: "result",
            success: true,
            result: message.type === "get_states" ? [] : null,
          }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);

  await page.evaluate(() => {
    apriConfigEntita();
    editorSwitch("sez1");
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.locator(".ed-inner-tab", { hasText: /^REPORT$/i }).click();
}

for (const variant of PRIMARY) {
  test(`${variant}: manual Report entry stays collapsed until requested`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    const panel = page.locator('[data-energy-panel="report"]');
    const button = panel.locator("[data-report-add]");
    const form = panel.locator("[data-report-manual]");

    await expect(panel).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(form).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(form).toBeVisible();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(form).toBeHidden();
  });
}

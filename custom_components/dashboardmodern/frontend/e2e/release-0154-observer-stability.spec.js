import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = ["oven", "fridge", "microwave", "boiler"].map((name) => ({
  entity_id: `switch.${name}`,
  state: "on",
  attributes: { friendly_name: name },
}));

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-kitchen", name: "Cucina", icon: "mdi:countertop" }],
    appliances: [
      ["oven", "Forno", "forno"],
      ["fridge", "Frigo", "frigo"],
      ["microwave", "Microonde", "microonde"],
      ["boiler", "Scaldabagno", "scaldabagno"],
    ].map(([id, name, visual]) => ({
      id: `appliance-${id}`,
      section: "appliances",
      name,
      device_type: visual,
      visual_type: "asset",
      visual_key: visual,
      room_id: "room-kitchen",
      control_entity: `switch.${id}`,
      entities: [`switch.${id}`],
      show_in_dashboard: true,
      show_in_report: true,
    })),
    loads: [],
    energy: { house: {}, grid: {}, solar: {}, battery: {}, metadata: {} },
  },
  visibility: { appliances: true, energy: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript((haStates) => {
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.emit({ type: "auth_required" }));
      }
      emit(message) {
        const event = new MessageEvent("message", { data: JSON.stringify(message) });
        this.dispatchEvent(event);
        this.onmessage?.(event);
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") {
          this.emit({ type: "auth_ok" });
          return;
        }
        const result =
          message.type === "get_states"
            ? haStates
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : [];
        this.emit({ id: message.id, type: "result", success: true, result });
      }
      close() {}
    };
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__?.observerVersion === 2,
  );
  await clickBottomTab(page, "appliances-main", testInfo);
  await expect(page.locator("#appl-grid-overview .appl-wide-card")).toHaveCount(4);
  await page.waitForTimeout(300);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: appliance style and DOM observers remain bounded`, async ({ page }, testInfo) => {
    if (testInfo.project.name.includes("webkit")) test.slow(true);
    await boot(page, variant, testInfo);

    const result = await page.evaluate(async () => {
      let headMutations = 0;
      let cardMutations = 0;
      let ticks = 0;
      const headObserver = new MutationObserver((records) => {
        headMutations += records.reduce(
          (total, record) => total + record.addedNodes.length + record.removedNodes.length,
          0,
        );
      });
      const cardObserver = new MutationObserver((records) => {
        cardMutations += records.length;
      });
      headObserver.observe(document.head, { childList: true });
      cardObserver.observe(document.getElementById("appl-grid-overview"), {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-dm-artwork", "data-dm-art-style", "class", "src"],
      });
      const timer = setInterval(() => {
        ticks += 1;
      }, 25);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      clearInterval(timer);
      headObserver.disconnect();
      cardObserver.disconnect();

      const styleIds = [...document.head.querySelectorAll("style[id]")].map((style) => style.id);
      return {
        headMutations,
        cardMutations,
        ticks,
        legacyDisabled: window.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__,
        legacyStyleObserver: Boolean(window.__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__),
        legacyDomObserver: Boolean(window.__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__),
        legacyStyleCount: styleIds.filter((id) => id === "dm-appliance-media-layout-lock-0153").length,
        finalStyleCount: styleIds.filter((id) => id === "dm-release-0154-final-artwork-lock").length,
      };
    });

    expect(result).toMatchObject({
      legacyDisabled: true,
      legacyStyleObserver: false,
      legacyDomObserver: false,
      legacyStyleCount: 1,
      finalStyleCount: 1,
    });
    expect(result.headMutations).toBeLessThanOrEqual(4);
    expect(result.cardMutations).toBeLessThanOrEqual(24);
    expect(result.ticks).toBeGreaterThanOrEqual(20);
  });
}

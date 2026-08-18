import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { fillEntityFieldByHand, showRawEntityFields } from "./helpers/entity-field.js";
import { clickBottomTab, clickStableButton } from "./helpers/navigation.js";

const haStates = [
  { entity_id: "light.salone", state: "on", attributes: { friendly_name: "Luce salone" } },
  {
    entity_id: "cover.salone",
    state: "open",
    attributes: { friendly_name: "Tapparella salone", current_position: 65 },
  },
  {
    entity_id: "cover.cucina",
    state: "closed",
    attributes: { friendly_name: "Tapparella cucina", current_position: 0 },
  },
  {
    entity_id: "sensor.forno_power",
    state: "850",
    attributes: { friendly_name: "Forno power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.forno_energy",
    state: "4.2",
    attributes: { friendly_name: "Forno energy", unit_of_measurement: "kWh" },
  },
];

const dashboardSeed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", floor: "Terra" }],
    lights: [{ id: "light-salone", name: "Luce salone", entities: ["light.salone"] }],
    appliances: [],
    loads: [],
    covers: [],
  },
  visibility: { home: true, energy: true, appliances: true, tapparelle: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((states) => {
    window.__haCalls = [];
    class MockBridgeSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = MockBridgeSocket.OPEN;
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
        if (message.type === "call_service") window.__haCalls.push(structuredClone(message));
        let result = null;
        if (message.type === "get_states") result = states;
        else if (message.type === "frontend/get_user_data") result = { value: null };
        this.onmessage?.({
          data: JSON.stringify({
            id: message.id,
            type: "result",
            success: true,
            result,
          }),
        });
      }
      close() {
        this.readyState = MockBridgeSocket.CLOSED;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  }, haStates);
  await bootNamespacedDashboard(page, variant, testInfo, dashboardSeed);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bridgeType: typeof window.__DASHBOARDMODERN_BRIDGE_WS__,
        serviceType: typeof window.dmCallHaService,
      })),
    )
    .toEqual({
      bridgeType: "function",
      serviceType: "function",
    });
  await expect
    .poll(() =>
      page.evaluate(() => DashboardModernModules.store.getSection("rooms").map((room) => room.id)),
    )
    .toContain("room-salone");
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (states) =>
      states.forEach((state) => {
        _RAW_STATES[state.entity_id] = structuredClone(state);
        STATES[state.entity_id] = structuredClone(state);
      }),
    haStates,
  );
  await page.evaluate(() => window.render?.());
}

async function openEnergyAnalysis(page, testInfo) {
  await clickBottomTab(page, "energy", testInfo);
  const energyPage = page.locator("#page-energy.active");
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /^📊?\s*Report$/i }),
    testInfo,
  );
  await expect(page.locator("#view-panoramica")).toBeVisible();
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /Analisi|Analysis/i }),
    testInfo,
  );
  await expect(page.locator("#ed-pane-analisi")).toBeVisible();
}

async function openEditor(page, tab) {
  await page.locator(".ha-menu-btn").click();
  await page.locator("#cd-app-menu button", { hasText: /Configurazione|Configuration/ }).click();
  await page.locator(`.ed-tab[data-tab="${tab}"]`).click();
}

async function chooseEntity(page, input, entity) {
  await input
    .locator("xpath=following-sibling::button[contains(@class,'dm-entity-picker')][1]")
    .click();
  await page.locator("#cd-ep-search").fill(entity);
  await page.locator("#cd-ep-list", { hasText: entity }).locator("div[onclick]").click();
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real shutter editor drives the live warning popup`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "Full real UI flow is slower on WebKit/iPad");
    await boot(page, variant, testInfo);
    await openEditor(page, "tapp");
    for (const [name, entity] of [
      ["Tapparella salone", "cover.salone"],
      ["Tapparella cucina", "cover.cucina"],
    ]) {
      await page.locator("#ed-tp-name").fill(name);
      await fillEntityFieldByHand(page, "#ed-tp-ent", entity);
      await page.locator("#ed-tp-room").selectOption("room-salone");
      await page.locator("#ed-body .ed-btn-add", { hasText: /tapparella|shutter/i }).click();
    }
    await expect
      .poll(() => page.evaluate(() => getTapparelle().map((item) => item.entity)))
      .toEqual(["cover.salone", "cover.cucina"]);
    await expect
      .poll(() =>
        page.evaluate(() => (typeof STATES !== "undefined" ? STATES["cover.salone"]?.state : null)),
      )
      .toBe("open");
    await page.locator("#editor-modal .ed-head-close").last().click();
    const shutter = page.locator("#tapp-avvisi .dm-shutter-alert");
    await expect(shutter.locator(".g-name")).toContainText(/TAPPARELLA APERTA|SHUTTER OPEN/);
    await expect(shutter.locator(".g-val")).toHaveText("1");
    const lightCard = page.locator("#glance-luci.glance-card");
    const shutterCard = page.locator("#tapp-avvisi .dm-shutter-alert");
    await expect(lightCard).toBeVisible();
    await expect(shutterCard).toBeVisible();
    const [lightBox, shutterBox] = await Promise.all([
      lightCard.boundingBox(),
      shutterCard.boundingBox(),
    ]);
    if (!lightBox || !shutterBox) throw new Error("Alert cards have no bounding box");
    expect(Math.abs(lightBox.height - shutterBox.height)).toBeLessThanOrEqual(2);
    const styles = await Promise.all(
      [lightCard, shutterCard].map((card) =>
        card.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            borderRadius: style.borderRadius,
            padding: style.padding,
            boxShadow: style.boxShadow,
            display: style.display,
            alignItems: style.alignItems,
          };
        }),
      ),
    );
    await expect(lightCard).toHaveClass(/glance-card/);
    await expect(shutterCard).toHaveClass(/glance-card/);
    expect(styles[1].borderRadius).toBe(styles[0].borderRadius);
    expect(styles[1].padding).toBe(styles[0].padding);
    expect(styles[1].display).toBe(styles[0].display);
    expect(styles[1].alignItems).toBe(styles[0].alignItems);
    expect(styles[0].boxShadow).not.toBe("none");
    expect(styles[1].boxShadow).not.toBe("none");
    await shutter.click();
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await page.waitForTimeout(2600);
    await expect(page.locator("#tapp-avvisi .dm-shutter-alert")).toHaveCount(1);
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await expect(page.locator("#dm-shutter-popup")).toContainText("Tapparella salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("Salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("65%");
    const close = page.locator('[data-shutter-service="close_cover"]').first();
    await clickStableButton(page, close, testInfo);
    await expect
      .poll(() => page.evaluate(() => window.__haCalls.at(-1)))
      .toMatchObject({
        type: "call_service",
        domain: "cover",
        service: "close_cover",
        service_data: { entity_id: "cover.salone" },
      });
    await expect(close).toBeDisabled();
    await expect(close).toHaveText(/Chiusura…|Closing…/);
    await page.waitForTimeout(2600);
    await expect(close).toBeDisabled();
    await expect(close).toHaveText(/Chiusura…|Closing…/);
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-shutter-popup.png`,
    });
    await page.evaluate(() => {
      STATES["cover.salone"].state = "opening";
      STATES["cover.salone"].attributes.current_position = 25;
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: {
            entity_id: "cover.salone",
            entity_ids: ["cover.salone"],
            state: STATES["cover.salone"],
          },
        }),
      );
    });
    await expect(page.locator("#dm-shutter-popup")).toContainText("25%");
    await page.evaluate(() => {
      for (const id of ["cover.salone", "cover.cucina"]) {
        STATES[id].state = "closed";
        STATES[id].attributes.current_position = 0;
      }
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: {
            entity_id: "cover.cucina",
            entity_ids: ["cover.salone", "cover.cucina"],
            state: STATES["cover.cucina"],
          },
        }),
      );
    });
    await expect(shutter).toHaveCount(0);
    await expect(page.locator("#dm-shutter-popup")).toHaveCount(0);
  });

  test(`${variant}: appliance Editor persists Forno through Energy Report and reload`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "Full real UI flow is slower on WebKit/iPad");
    await boot(page, variant, testInfo);
    await openEditor(page, "appliances");
    for (let index = 0; index < 20; index += 1)
      await page.evaluate(() => editorSwitch("appliances"));
    await expect(page.locator("#ed-body #appl-ent")).toHaveCount(1);
    await showRawEntityFields(page);
    await expect(
      page.locator('#ed-body .dm-entity-picker[data-entity-target="appl-ent"]'),
    ).toHaveCount(1);
    await page.locator("#appl-icon-btn").click();
    await page.locator("#dm-applpick button", { hasText: /Forno|Oven/i }).click();
    await page.locator("#appl-name").fill("Forno");
    await page.locator("#appl-room").selectOption("room-salone");
    for (const entity of ["sensor.forno_power", "sensor.forno_energy"]) {
      await chooseEntity(page, page.locator("#appl-ent"), entity);
      await page.locator("#ed-body .ed-btn-add", { hasText: /questa entità|this entity/i }).click();
    }
    await page
      .locator("#ed-body .ed-btn-add", { hasText: /Aggiungi elettrodomestico|Add appliance/i })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store
            .getSection("appliances")
            .find((item) => item.name === "Forno"),
        ),
      )
      .toMatchObject({
        entities: ["sensor.forno_power", "sensor.forno_energy"],
        room_id: "room-salone",
        show_in_report: true,
      });
    await expect
      .poll(() => page.evaluate(() => ED_DEVICES.find((device) => device.name === "Forno")?.sensor))
      .toBe("sensor.forno_energy");
    await page.locator("#editor-modal .ed-head-close").last().click();
    await openEnergyAnalysis(page, testInfo);
    await expect(page.locator("#ed-dev-selector")).toContainText("Forno");
    await expect(page.locator("#ed-dev-selector option", { hasText: "Forno" })).toHaveAttribute(
      "value",
      "sensor.forno_energy",
    );
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-energy-report-forno.png`,
    });
    await page.reload();
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    );
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store
            .getSection("appliances")
            .some((item) => item.name === "Forno"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => ED_DEVICES.find((device) => device.name === "Forno")?.sensor))
      .toBe("sensor.forno_energy");
    await openEnergyAnalysis(page, testInfo);
    await expect(page.locator("#ed-dev-selector option", { hasText: "Forno" })).toHaveAttribute(
      "value",
      "sensor.forno_energy",
    );
  });
}

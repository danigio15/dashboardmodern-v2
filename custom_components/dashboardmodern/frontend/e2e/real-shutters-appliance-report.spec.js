import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }));
      }
      send(raw) {
        const message = JSON.parse(raw);
        const result = message.type === "get_states" ? states : [];
        this.onmessage?.({
          data: JSON.stringify(
            message.type === "auth"
              ? { type: "auth_ok" }
              : { id: message.id, type: "result", success: true, result },
          ),
        });
      }
      close() {}
    };
  }, haStates);
  await bootNamespacedDashboard(page, variant, testInfo, dashboardSeed);
  await expect
    .poll(() =>
      page.evaluate(() => DashboardModernModules.store.getSection("rooms").map((room) => room.id)),
    )
    .toContain("room-salone");
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.addScriptTag({ url: "/legacy/runtime-hotfix.js" });
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_HOTFIX__);
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

async function openEnergy(page) {
  const handle = page.locator("#bottomNavHandle");
  if (await handle.isVisible()) await handle.click();
  else {
    const viewport = page.viewportSize();
    if (viewport) await page.mouse.move(viewport.width / 2, viewport.height - 1);
  }
  const tab = page.locator('.tab[data-tab="energy"]');
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real shutter editor drives the live warning popup`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);
    await openEditor(page, "tapp");
    for (const [name, entity] of [
      ["Tapparella salone", "cover.salone"],
      ["Tapparella cucina", "cover.cucina"],
    ]) {
      await page.locator("#ed-tp-name").fill(name);
      await page.locator("#ed-tp-ent").fill(entity);
      await page.locator("#ed-tp-room").selectOption("room-salone");
      await page.locator("#ed-body .ed-btn-add", { hasText: /tapparella|shutter/i }).click();
    }
    await page.locator("#editor-modal .ed-head-close").last().click();
    const shutter = page.locator("#tapp-avvisi .dm-shutter-alert");
    await expect(shutter.locator(".g-name")).toContainText(/TAPPARELLA APERTA|SHUTTER OPEN/);
    await expect(shutter.locator(".g-val")).toHaveText("1");
    await expect(page.locator("#glance-luci .g-name")).toHaveCount(1);
    const [lightBox, shutterBox] = await Promise.all([
      page.locator("#glance-luci").boundingBox(),
      shutter.boundingBox(),
    ]);
    expect(Math.abs((lightBox?.height || 0) - (shutterBox?.height || 0))).toBeLessThanOrEqual(2);
    await shutter.click();
    await expect(page.locator("#dm-shutter-popup")).toContainText("Tapparella salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("Salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("65%");
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-shutter-popup.png`,
    });
    await page.evaluate(() => {
      STATES["cover.salone"].state = "opening";
      STATES["cover.salone"].attributes.current_position = 25;
    });
    await expect(page.locator("#dm-shutter-popup")).toContainText("25%");
    await page.evaluate(() => {
      for (const id of ["cover.salone", "cover.cucina"]) {
        STATES[id].state = "closed";
        STATES[id].attributes.current_position = 0;
      }
    });
    await expect(shutter).toHaveCount(0);
    await expect(page.locator("#dm-shutter-popup")).toHaveCount(0);
  });

  test(`${variant}: appliance Editor persists Forno through Energy Report and reload`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);
    await openEditor(page, "appliances");
    for (let index = 0; index < 20; index += 1)
      await page.locator('.ed-tab[data-tab="appliances"]').click();
    await expect(page.locator("#ed-body #appl-ent")).toHaveCount(1);
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
    await page.locator("#editor-modal .ed-head-close").last().click();
    await openEnergy(page);
    await page.getByRole("button", { name: /Report/i }).click();
    await page.getByRole("button", { name: /Analisi|Analysis/i }).click();
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
    await openEnergy(page);
    await page.getByRole("button", { name: /Report/i }).click();
    await page.getByRole("button", { name: /Analisi|Analysis/i }).click();
    await expect(page.locator("#ed-dev-selector option", { hasText: "Forno" })).toHaveAttribute(
      "value",
      "sensor.forno_energy",
    );
  });
}

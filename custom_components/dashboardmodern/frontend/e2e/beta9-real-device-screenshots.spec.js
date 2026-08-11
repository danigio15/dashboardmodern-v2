import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "25.8",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "52",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "cover.tapparella",
    state: "open",
    attributes: { friendly_name: "Tapparella", current_position: 100 },
  },
  {
    entity_id: "light.ingresso",
    state: "off",
    attributes: { friendly_name: "Ingresso" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "mdi:sofa",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
      },
      { id: "room-bagno", name: "Bagno", icon: "mdi:shower", temp: "", hum: "" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { id: "light-ingresso", name: "Ingresso", entities: ["light.ingresso"], room_id: "room-cameretta" },
    ],
    climate: [],
    ev: [
      {
        id: "ev-b10",
        name: "B10",
        brand: "Leapmotor",
        model: "B10",
        icon: "mdi:car-electric",
        ov: {},
      },
    ],
    covers: [
      { id: "cover-main", name: "Tapparella", entity: "cover.tapparella", room_id: "room-cameretta" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true, temp: true, temperature: true, tapparelle: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
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
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true)).toBe(true);
  await page.evaluate((haStates) => {
    haStates.forEach((item) => {
      _RAW_STATES[item.entity_id] = structuredClone(item);
      STATES[item.entity_id] = structuredClone(item);
    });
  }, states);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
  await page.waitForTimeout(100);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta9 matches the real-device screenshot contracts`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 120_000);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      localStorage.setItem("cd_quick_actions", JSON.stringify([
        { type: "builtin", builtin: "luci", name: "Gestione Luci" },
        { type: "builtin", builtin: "clima", name: "Clima" },
        { type: "builtin", builtin: "antifurto", name: "Antifurto" },
        { type: "builtin", builtin: "lavatrice", name: "Lavatrice" },
        { type: "toggle", name: "Cancello", icon: "⛩️", entity: "switch.cancello" },
      ]));
      window.buildQuickActions?.();
    });
    await expect(page.locator("#qa-grid .dm-v01525-action-glyph")).toHaveCount(5);
    await expect(page.locator("#qa-grid .dm-v01525-action-glyph").nth(0)).toHaveText("💡");
    await expect(page.locator("#qa-grid .dm-v01525-action-glyph").nth(1)).toHaveText("❄️");
    await expect(page.locator("#qa-grid .dm-v01525-action-glyph").nth(2)).toHaveText("🛡️");
    await expect(page.locator("#qa-grid .dm-v01525-action-glyph").nth(3)).toHaveText("🧺");
    await expect(page.locator("#page-home")).not.toContainText(/AZIONI RAPIDE PREMIUM|PREMIUM QUICK ACTIONS/i);

    await openEditor(page, "sez2");
    const appearance = page.locator("#ed-body [data-ev-appearance]");
    await expect(appearance).toBeVisible();
    expect(await appearance.evaluate((node) => node.parentElement?.firstElementChild === node)).toBe(true);
    const brand = appearance.locator("select[data-brand]");
    const model = appearance.locator("select[data-model]");
    await brand.selectOption("MINI");
    await expect(appearance.locator('[data-brand-preview] .dm-car-brand[data-brand="mini"]')).toHaveCount(1);
    await expect(model).toContainText("Cooper Electric");
    await expect(model).toContainText("Aceman");
    await expect(model).toContainText("Countryman Electric");
    await expect(model).toBeEnabled();
    await model.selectOption("Cooper Electric");
    await expect(appearance.locator("[data-brand-preview]")).toContainText("Cooper Electric");

    await appearance.locator("[data-brand-preview]").click();
    const brandPicker = page.locator('#dm-visual-picker[data-kind="car"]');
    await expect(brandPicker).toBeVisible();
    const brandVisuals = brandPicker.locator(".dm-picker-option .dm-picker-visual");
    expect(await brandVisuals.count()).toBeGreaterThan(20);
    expect(await brandVisuals.evaluateAll((nodes) => nodes.every((node) => {
      const box = node.getBoundingClientRect();
      return box.width >= 70 && box.height >= 38 && getComputedStyle(node).overflow === "hidden";
    }))).toBe(true);
    const brandColors = await brandPicker.locator(".dm-car-brand").evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => getComputedStyle(node).color))],
    );
    expect(brandColors).toHaveLength(1);
    await brandPicker.locator("[data-close]").click();

    await openEditor(page, "stanze");
    const roomRow = page.locator("#ed-body .dm-room-config-row", { hasText: "Cameretta" }).first();
    await expect(roomRow).toBeVisible();
    await expect(roomRow.locator('.dm-room-list-icon[data-room-icon="mdi:sofa"]')).toBeVisible();
    await expect(roomRow.locator(".dm-room-list-icon svg")).toHaveCount(1);

    await openEditor(page, "sez7");
    const configuredTemperature = page.locator('#editor-modal [data-temperature-room][data-room-id="room-cameretta"]');
    await expect(configuredTemperature).toBeVisible();
    await configuredTemperature.locator("[data-temperature-edit]").click();
    const temperatureSelect = page.locator("#dm-temperature-room");
    await expect(temperatureSelect).toBeEnabled();
    await expect(temperatureSelect).toHaveAttribute("data-dm-real-device-editable", "true");
    await expect(temperatureSelect).toHaveCSS("pointer-events", "auto");
    await temperatureSelect.selectOption("room-bagno");
    await expect(temperatureSelect).toHaveValue("room-bagno");

    await openEditor(page, "luci");
    const lightForm = page.locator('#ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"]');
    await expect(lightForm).toBeVisible();
    const lightGeometry = await lightForm.evaluate((form) => {
      const row = form.querySelector(".dm-light-add-entity-row");
      const entity = form.querySelector("#luce-add-ent");
      const search = row?.querySelector(".dm-entity-picker");
      const name = form.querySelector("#luce-add-name");
      return {
        noOverflow: form.scrollWidth <= form.clientWidth + 1,
        rowColumns: row ? getComputedStyle(row).gridTemplateColumns : "",
        entityWidth: entity?.getBoundingClientRect().width || 0,
        searchWidth: search?.getBoundingClientRect().width || 0,
        nameWidth: name?.getBoundingClientRect().width || 0,
      };
    });
    expect(lightGeometry.noOverflow).toBe(true);
    expect(lightGeometry.entityWidth).toBeGreaterThan(180);
    expect(lightGeometry.searchWidth).toBeGreaterThanOrEqual(54);
    expect(lightGeometry.nameWidth).toBeGreaterThan(240);

    await page.locator("#editor-modal .ed-head-close").last().click();
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-tapparelle")?.classList.add("active");
      window.renderTapparelle?.();
    });
    const shutterCard = page.locator("#page-tapparelle .tapp-card").first();
    await expect(shutterCard).toBeVisible();
    const shutterGeometry = await shutterCard.evaluate((card) => ({
      width: card.getBoundingClientRect().width,
      windowHeight: card.querySelector(".tapp-win")?.getBoundingClientRect().height || 0,
      slatAnimation: getComputedStyle(card.querySelector(".tapp-shutter i")).animationName,
    }));
    expect(shutterGeometry.width).toBeLessThanOrEqual(361);
    expect(shutterGeometry.windowHeight).toBeLessThanOrEqual(133);
    expect(shutterGeometry.slatAnimation).toBe("none");

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-home")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: { entity_id: "cover.tapparella" } }));
    });
    const shutterAlertIcon = page.locator("#page-home .dm-shutter-alert .g-icon-wrap");
    await expect(shutterAlertIcon).toBeVisible();
    await expect(shutterAlertIcon).toHaveAttribute("data-dm-alert-motion", "static");
    await expect(shutterAlertIcon).not.toHaveClass(/anim-ping/);
  });
}

import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  { entity_id: "light.salone", state: "on", attributes: { friendly_name: "Luce salone" } },
  { entity_id: "switch.forno", state: "off", attributes: { friendly_name: "Forno" } },
  { entity_id: "cover.salone", state: "open", attributes: { friendly_name: "Tapparella salone", current_position: 65 } },
  { entity_id: "sensor.forno_power", state: "850", attributes: { friendly_name: "Forno power", unit_of_measurement: "W", device_class: "power" } },
  { entity_id: "sensor.forno_energy", state: "4.2", attributes: { friendly_name: "Forno energy", unit_of_measurement: "kWh", device_class: "energy" } },
  { entity_id: "sensor.salone_temperature", state: "22.4", attributes: { unit_of_measurement: "°C", device_class: "temperature" } },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", temp: "sensor.salone_temperature" }],
    lights: [{ id: "light-salone", name: "Luce salone", entities: ["light.salone"] }],
    appliances: [{
      id: "appl-forno",
      name: "Forno",
      device_type: "forno",
      visual_type: "asset",
      visual_key: "forno",
      entities: ["sensor.forno_power", "sensor.forno_energy", "switch.forno"],
      room_id: "room-salone",
      show_in_report: true,
    }],
    loads: [],
    covers: [{ id: "cover-salone", name: "Tapparella salone", entity: "cover.salone", entities: ["cover.salone"], room_id: "room-salone" }],
  },
  visibility: { home: true, energy: true, appliances: true, tapparelle: true, temp: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockBridgeSocket extends EventTarget {
      readyState = 1;
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
        window.__REAL_HA_CALLS__ ||= [];
        if (message.type === "call_service") window.__REAL_HA_CALLS__.push(message);
        if (message.type === "auth") return;
        const result = message.type === "get_states" ? haStates : message.type === "frontend/get_user_data" ? { value: null } : null;
        this.onmessage?.({ data: JSON.stringify({ id: message.id, type: "result", success: true, result }) });
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.evaluate(() => {
    localStorage.setItem("cd_gruppi_extra", JSON.stringify({ luci: ["light.salone"] }));
    localStorage.setItem("cd_avvisi_names_extra", JSON.stringify({ "light.salone": "Luce salone" }));
    localStorage.setItem("cd_luci", JSON.stringify({ "light.salone": "Luce salone" }));
    localStorage.setItem("cd_luci_rooms", JSON.stringify({ "light.salone": "Salone" }));
  });
  await page.reload();
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haStates) => haStates.forEach((state) => {
    _RAW_STATES[state.entity_id] = structuredClone(state);
    STATES[state.entity_id] = structuredClone(state);
  }), states);
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_REAL_HA_0147__?.installed === true)).toBe(true);
  await page.evaluate(() => window.render?.());
}

async function openEditor(page, tab) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.evaluate((target) => editorSwitch(target), tab);
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real Home Assistant acceptance fixes preserve entities and editing`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 100_000);
    await boot(page, variant, testInfo);

    await expect.poll(() => page.evaluate(() => DashboardModernModules.store.getSection("appliances")[0])).toMatchObject({
      power_entity: "sensor.forno_power",
      energy_entity: "sensor.forno_energy",
      report_entity: "sensor.forno_energy",
      control_entity: "switch.forno",
    });

    await expect.poll(() => page.evaluate(() => WebSocket.OPEN)).toBe(1);
    await page.evaluate(() => dmCallHaService("cover", "close_cover", { entity_id: "cover.salone" }));
    await expect.poll(() => page.evaluate(() => window.__REAL_HA_CALLS__)).toContainEqual(expect.objectContaining({
      type: "call_service",
      domain: "cover",
      service: "close_cover",
      service_data: { entity_id: "cover.salone" },
    }));

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main").classList.add("active");
      renderApplianceSection(true);
    });
    const card = page.locator("#appl-view-overview.active .appl-wide-card.dm-control-device").filter({ hasText: "Forno" }).first();
    await expect(card).toBeVisible();
    await expect(card.locator(".appl-spark")).toHaveCount(0);
    const cardBox = await card.boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(410);
    expect(cardBox.height).toBeLessThanOrEqual(190);
    const toggle = card.locator('[data-dm-power-toggle="true"]');
    await expect(toggle).toHaveText(/Accendi|Spegni|Turn on|Turn off/);
    await expect(toggle).not.toHaveText(/[⏻×✕]/);

    await openEditor(page, "sez1");
    await page.locator(".ed-inner-tab", { hasText: /^REPORT$/i }).click();
    await expect(page.locator("#dm-report-entity-appl-forno")).toHaveValue("sensor.forno_energy");
    await page.evaluate(() => {
      cdRebuildReportDevices();
      buildReportSelect();
    });
    await expect(page.locator('#ed-dev-selector option[value="sensor.forno_energy"]')).toContainText("Forno");

    await openEditor(page, "avvisi");
    await page.locator('[data-real-alert-edit=""]').first().click();
    await expect(page.locator("#ed-avv-ent")).toHaveValue("light.salone");
    await page.locator("#ed-avv-name").fill("Luce principale");
    await page.locator('button[onclick="edAddAvviso()"]:visible').click();
    await expect.poll(() => page.evaluate(() => ({
      groups: JSON.parse(localStorage.getItem("cd_gruppi_extra") || "{}"),
      names: JSON.parse(localStorage.getItem("cd_avvisi_names_extra") || "{}"),
    }))).toEqual({ groups: { luci: ["light.salone"] }, names: { "light.salone": "Luce principale" } });

    await openEditor(page, "luci");
    await page.locator(".ed-lrow .dm-edit-button").first().click();
    await expect(page.locator("#luce-add-ent")).toHaveValue("light.salone");
    await page.locator("#luce-add-name").fill("Luce principale");
    await page.locator("#luce-add-room").selectOption({ label: "Salone" });
    await page.locator('button[onclick="cdLuceAdd()"]:visible').click();
    await expect.poll(() => page.evaluate(() => ({
      lights: JSON.parse(localStorage.getItem("cd_luci") || "{}"),
      rooms: JSON.parse(localStorage.getItem("cd_luci_rooms") || "{}"),
    }))).toEqual({ lights: { "light.salone": "Luce principale" }, rooms: { "light.salone": "Salone" } });

    await openEditor(page, "sez7");
    const actions = page.locator(".dm-temperature-actions");
    await expect(actions).toBeVisible();
    await expect(actions.locator("button").first()).toHaveCSS("min-height", "44px");

    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-real-ha-acceptance.png`, fullPage: true });
  });
}

import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  ...[1, 2, 3, 4].map((index) => ({
    entity_id: `light.cucina_${index}`,
    state: index % 2 ? "on" : "off",
    attributes: { friendly_name: `Luce cucina ${index}` },
  })),
  {
    entity_id: "climate.cucina",
    state: "off",
    attributes: { friendly_name: "Cucina", current_temperature: 31.8, temperature: 18 },
  },
  {
    entity_id: "climate.salone",
    state: "off",
    attributes: { friendly_name: "Salone", current_temperature: 31.7, temperature: 18 },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:stove" }],
    lights: [
      { id: "light-cucina-1", name: "Luce cucina 1", entities: ["light.cucina_1"], room_id: "room-cucina" },
      { id: "light-cucina-2", name: "Luce cucina 2", entities: ["light.cucina_2"], room_id: "room-cucina" },
      { id: "light-cucina-3", name: "Luce cucina 3", entities: ["light.cucina_3"], room_id: "room-cucina" },
      { id: "light-cucina-4", name: "Luce cucina 4", entities: ["light.cucina_4"], room_id: "room-cucina" },
    ],
    appliances: [],
    loads: [],
    climate: [],
    ev: [{ id: "ev-b10", name: "B10", brand: "Leapmotor", icon: "mdi:car", ov: {} }],
    energy: {},
  },
  visibility: { home: true, energy: true, ev: true, clima: true },
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
        const result = message.type === "get_states" ? haStates : message.type === "frontend/get_user_data" ? { value: null } : null;
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id: message.id, type: "result", success: true, result }) }));
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
    localStorage.setItem("cd_luci", JSON.stringify({
      "light.cucina_1": "Luce cucina 1",
      "light.cucina_2": "Luce cucina 2",
      "light.cucina_3": "Luce cucina 3",
      "light.cucina_4": "Luce cucina 4",
    }));
    localStorage.setItem("cd_luci_rooms", JSON.stringify({
      "light.cucina_1": "room-cucina",
      "light.cucina_2": "room-cucina",
      "light.cucina_3": "room-cucina",
      "light.cucina_4": "room-cucina",
    }));
    localStorage.setItem("cd_clima_units", JSON.stringify([
      { entity: "climate.cucina", name: "Cucina", type: "clima", room: "Cucina" },
      { entity: "climate.salone", name: "Salone", type: "clima", room: "Cucina" },
    ]));
  });
  await page.reload();
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true)).toBe(true);
  await page.evaluate((haStates) => {
    haStates.forEach((item) => {
      _RAW_STATES[item.entity_id] = structuredClone(item);
      STATES[item.entity_id] = structuredClone(item);
    });
    window.render?.();
    window.buildClimaCards?.();
  }, states);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
  await page.waitForTimeout(40);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta5 fixes the exact mobile editor regressions`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await openEditor(page, "visib");
    const renameRows = page.locator("#ed-body .ed-row[data-section-key]");
    await expect(renameRows.first()).toBeVisible();
    const renameCounts = await renameRows.evaluateAll((rows) => rows.map((row) => ({
      total: row.querySelectorAll(".dm-inline-rename[data-rename]").length,
      visible: [...row.querySelectorAll(".dm-inline-rename[data-rename]")].filter((button) => getComputedStyle(button).display !== "none").length,
    })));
    expect(renameCounts.length).toBeGreaterThan(3);
    expect(renameCounts.every((count) => count.total === 1 && count.visible === 1)).toBe(true);

    await openEditor(page, "luci");
    const lightRows = page.locator("#ed-body .dm-light-row");
    await expect(lightRows).toHaveCount(4);
    await expect(lightRows.first().locator(".ed-row-new")).toContainText(/Luce cucina 1/i);
    await expect(lightRows.first().locator(".ed-row-old")).toContainText("light.cucina_1");
    await expect(lightRows.first().locator(".dm-light-room")).toBeVisible();
    if (testInfo.project.name === "mobile") {
      const height = await lightRows.first().evaluate((row) => row.getBoundingClientRect().height);
      expect(height).toBeLessThan(150);
    }

    await openEditor(page, "avvisi");
    await expect(page.locator("#ed-avv-custom")).toBeHidden();
    await expect(page.locator('#ed-body button', { hasText: /^⚡$/ })).toHaveCount(0);
    await page.locator("#ed-avv-grp").selectOption("custom");
    await expect(page.locator("#ed-avv-custom")).toBeVisible();
    await page.locator("#ed-avv-grp").selectOption("win");
    await expect(page.locator("#ed-avv-custom")).toBeHidden();
    await expect(page.locator('#ed-body button', { hasText: /^⚡$/ })).toHaveCount(0);

    await openEditor(page, "sez2");
    const brandPreview = page.locator("#ed-body [data-brand-preview]");
    await expect(brandPreview).toBeVisible();
    await brandPreview.click();
    const picker = page.locator('#dm-visual-picker[data-kind="car"]');
    await expect(picker).toBeVisible();
    await expect(picker.locator(".dm-beta5-brand-logo svg").first()).toBeVisible();
    expect(await picker.locator(".dm-beta5-brand-logo svg").count()).toBeGreaterThan(20);
    const leap = picker.locator(".dm-picker-option", { hasText: "Leapmotor" });
    await expect(leap.locator('[data-brand-logo="leapmotor"] svg')).toBeVisible();
    await picker.locator("[data-close]").click();

    await page.locator("#editor-modal .ed-head-close").last().click();
    await page.locator('.tab[data-tab="clima"]').click();
    await expect(page.locator("#page-clima.active .cp-card").first()).toBeVisible();
    if (testInfo.project.name === "mobile") {
      const climateHeight = await page.locator("#page-clima.active .cp-card").first().evaluate((card) => card.getBoundingClientRect().height);
      expect(climateHeight).toBeLessThan(260);
      await expect(page.locator("#page-clima.active .clima-premium-grid")).toHaveCSS("grid-template-columns", /.+/);
    }
  });

  test(`${variant}: beta5 Energy chart never invents future days and keeps Wallbox in the flow`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(async () => {
      window.render?.();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(page.locator("#n-wb-day")).toHaveAttribute("data-dm-beta5-flow-complete", "true");
    await expect(page.locator("#n-wb-day")).not.toHaveCSS("display", "none");

    const result = await page.evaluate(async () => {
      let loading = document.getElementById("ed-chart-loading");
      let canvas = document.getElementById("ed-daily-canvas");
      if (!loading) {
        loading = document.createElement("div");
        loading.id = "ed-chart-loading";
        document.body.append(loading);
      }
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "ed-daily-canvas";
        document.body.append(canvas);
      }
      class MockChart {
        static getChart() { return null; }
        constructor(_context, config) { window.__BETA5_CHART_CONFIG__ = structuredClone(config); }
        destroy() {}
      }
      window.Chart = MockChart;
      const today = new Date();
      window.__DASHBOARDMODERN_RUNTIME_ROOT__.bundle = {
        ...(window.__DASHBOARDMODERN_RUNTIME_ROOT__.bundle || {}),
        day: {
          solar: 3.4,
          house: 3.1,
          gridImport: 0.1,
          gridExport: 0,
          batteryCharged: 2.4,
          batteryDischarged: 2.0,
        },
      };
      window.DashboardModernEnergyService.statisticsWithGrowth = async () => ({});
      const ok = await window.renderEdDailyChart(
        new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
        today.getMonth() + 1,
        today.getFullYear(),
        true,
        314,
        165,
      );
      const config = window.__BETA5_CHART_CONFIG__;
      return {
        ok,
        today: today.getDate(),
        labels: config?.data?.labels || [],
        production: config?.data?.datasets?.[0]?.data || [],
        consumption: config?.data?.datasets?.[1]?.data || [],
        marker: canvas.dataset.dmBeta5RealHistory || "",
      };
    });
    expect(result.ok).toBe(true);
    expect(result.labels).toHaveLength(result.today);
    expect(result.labels.at(-1)).toBe(String(result.today));
    expect(result.production.at(-1)).toBeCloseTo(3.4, 4);
    expect(result.consumption.at(-1)).toBeCloseTo(3.1, 4);
    expect(result.marker).toMatch(/^\d{4}-\d{2}$/);
  });
}

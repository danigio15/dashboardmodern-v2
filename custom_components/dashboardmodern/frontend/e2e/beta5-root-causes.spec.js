// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

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
      {
        id: "light-cucina-1",
        name: "Luce cucina 1",
        entities: ["light.cucina_1"],
        room_id: "room-cucina",
      },
      {
        id: "light-cucina-2",
        name: "Luce cucina 2",
        entities: ["light.cucina_2"],
        room_id: "room-cucina",
      },
      {
        id: "light-cucina-3",
        name: "Luce cucina 3",
        entities: ["light.cucina_3"],
        room_id: "room-cucina",
      },
      {
        id: "light-cucina-4",
        name: "Luce cucina 4",
        entities: ["light.cucina_4"],
        room_id: "room-cucina",
      },
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
        const result =
          message.type === "get_states"
            ? haStates
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
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
    localStorage.setItem(
      "cd_luci",
      JSON.stringify({
        "light.cucina_1": "Luce cucina 1",
        "light.cucina_2": "Luce cucina 2",
        "light.cucina_3": "Luce cucina 3",
        "light.cucina_4": "Luce cucina 4",
      }),
    );
    localStorage.setItem(
      "cd_luci_rooms",
      JSON.stringify({
        "light.cucina_1": "room-cucina",
        "light.cucina_2": "room-cucina",
        "light.cucina_3": "room-cucina",
        "light.cucina_4": "room-cucina",
      }),
    );
    localStorage.setItem(
      "cd_clima_units",
      JSON.stringify([
        { entity: "climate.cucina", name: "Cucina", type: "clima", room: "Cucina" },
        { entity: "climate.salone", name: "Salone", type: "clima", room: "Cucina" },
      ]),
    );
  });
  await page.reload();
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
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

for (const variant of PRIMARY) {
  test(`${variant}: beta5 fixes the exact mobile editor regressions`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await openEditor(page, "visib");
    const renameRows = page.locator("#ed-body .ed-row[data-section-key]");
    await expect(renameRows.first()).toBeVisible();
    await expect
      .poll(
        async () => {
          const renameCounts = await renameRows.evaluateAll((rows) =>
            rows.map((row) => ({
              total: row.querySelectorAll(".dm-inline-rename[data-rename]").length,
              visible: [...row.querySelectorAll(".dm-inline-rename[data-rename]")].filter(
                (button) => getComputedStyle(button).display !== "none",
              ).length,
            })),
          );
          return (
            renameCounts.length > 3 &&
            renameCounts.every((count) => count.total === 1 && count.visible === 1)
          );
        },
        { timeout: 5_000 },
      )
      .toBe(true);

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

    // Gli avvisi non hanno più una linguetta loro: vivono in fondo alla
    // scheda dei widget, con gli stessi campi.
    await openEditor(page, "todo");
    await expect(page.locator("#ed-avv-custom")).toBeHidden();
    await expect(page.locator("#ed-body button", { hasText: /^⚡$/ })).toHaveCount(0);
    await page.locator("#ed-avv-grp").selectOption("custom");
    await expect(page.locator("#ed-avv-custom")).toBeVisible();
    await page.locator("#ed-avv-grp").selectOption("win");
    await expect(page.locator("#ed-avv-custom")).toBeHidden();
    await expect(page.locator("#ed-body button", { hasText: /^⚡$/ })).toHaveCount(0);

    await openEditor(page, "sez2");
    const brandPreview = page.locator("#ed-body [data-brand-preview]");
    await expect(brandPreview).toBeVisible();
    await brandPreview.click();
    const picker = page.locator('#dm-visual-picker[data-kind="car"]');
    await expect(picker).toBeVisible();
    /* Il marchio non e' piu' un `<img>` che punta a un CDN.
     *
     * Le figure stanno nel repository, servite da Home Assistant, e si
     * disegnano come maschera: un SVG dentro un `<img>` e' un documento a
     * parte e non vede il colore di chi lo ospita, quindi resterebbe nero.
     * Su una rete di casa senza uscita verso internet, poi, un logo preso da
     * un CDN non arriva — e un'immagine che non arriva non fa rumore. */
    const realBrandImages = picker.locator(".dm-car-brand [data-dm-brand-image]");
    expect(await realBrandImages.count()).toBeGreaterThan(20);
    await expect(realBrandImages.first()).toHaveAttribute("style", /brands\/[a-z0-9-]+\.svg/);
    for (const stile of await realBrandImages.evaluateAll((nodi) =>
      nodi.map((nodo) => nodo.getAttribute("style") || ""),
    ))
      expect(stile, "nessun marchio arriva dalla rete").not.toMatch(/https?:/);
    const leap = picker.locator(".dm-picker-option", { hasText: "Leapmotor" });
    const leapMark = leap.locator(
      '.dm-leapmotor-mark[data-brand="leapmotor"][data-brand-source="inline"]',
    );
    await expect(leapMark).toHaveCount(1);
    await expect(leapMark.locator("svg")).toHaveCount(1);
    await expect(leap.locator('img[data-dm-brand-image="leapmotor"]')).toHaveCount(0);
    await picker.locator("[data-close]").click();

    await page.locator("#editor-modal .ed-head-close").last().click();
    // On narrow hosted frames the horizontal navbar can live outside the
    // physical viewport. DOM click exercises the same application handler
    // without turning navbar scrolling into a prerequisite for this layout test.
    await page.locator('.tab[data-tab="clima"]').evaluate((button) => button.click());
    // The climate redesign owns this page: cards are .dm-cl-card inside
    // .dm-cl-grid, which is what keeps the legacy .cp-card corrections from
    // fighting over the layout.
    await expect(page.locator("#page-clima.active .dm-cl-card").first()).toBeVisible();
    if (testInfo.project.name === "mobile") {
      const climateHeight = await page
        .locator("#page-clima.active .dm-cl-card")
        .first()
        .evaluate((card) => card.getBoundingClientRect().height);
      expect(climateHeight).toBeLessThan(260);
      await expect(page.locator("#page-clima.active .dm-cl-grid").first()).toHaveCSS(
        "grid-template-columns",
        /.+/,
      );
    }
  });

  test(`${variant}: beta5 Energy chart draws one flow bubble per configured load and none otherwise`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(async () => {
      window.render?.();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    // The hand-authored circles and connectors are never the stage any more:
    // with nothing configured the area below Home is simply empty.
    for (const id of ["n-wb", "n-wb-day", "n-wb-month"]) {
      await expect(page.locator(`#${id}`)).toHaveCSS("display", "none");
    }
    for (const id of ["line-home-wb", "line-home-wb-day", "line-home-wb-month"]) {
      await expect(page.locator(`#${id}`)).toHaveCSS("display", "none");
    }
    for (const view of ["view-ist", "view-day", "view-month"]) {
      await expect(page.locator(`#${view} [data-dm-flow-node]`)).toHaveCount(0);
    }

    await page.evaluate(async () => {
      await DashboardModernModules.store.replaceSection("loads", [
        { id: "flow-boiler", name: "Boiler", order: 0, show_in_dashboard: true },
        { id: "flow-wallbox", name: "Wallbox", order: 1, show_in_dashboard: true },
      ]);
      window.render?.();
      await new Promise((resolve) => setTimeout(resolve, 180));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    for (const view of ["view-ist", "view-day", "view-month"]) {
      await expect(page.locator(`#${view} [data-dm-flow-node]`)).toHaveCount(2);
      await expect(
        page.locator(`#${view} [data-dm-flow-node="flow-wallbox"] .node-label`),
      ).toHaveText("Wallbox");
      await expect(
        page.locator(`#${view} svg.desktop-svg [data-dm-flow-arc="flow-wallbox"]`),
      ).toHaveCount(1);
    }
    // The legacy circles stay out of the way instead of doubling the new ones.
    await expect(page.locator("#n-wb")).toHaveCSS("display", "none");
    await expect(page.locator("#line-home-wb")).toHaveCSS("display", "none");

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
        static getChart() {
          return null;
        }
        constructor(_context, config) {
          window.__BETA5_CHART_CONFIG__ = {
            labels: [...(config?.data?.labels || [])],
            production: [...(config?.data?.datasets?.[0]?.data || [])],
            consumption: [...(config?.data?.datasets?.[1]?.data || [])],
          };
        }
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
      const config = window.__BETA5_CHART_CONFIG__ || {};
      return {
        ok,
        today: today.getDate(),
        labels: config.labels || [],
        production: config.production || [],
        consumption: config.consumption || [],
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

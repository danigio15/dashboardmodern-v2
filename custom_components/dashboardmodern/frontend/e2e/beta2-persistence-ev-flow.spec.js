// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [
      {
        id: "ev-pluto",
        name: "Pluto",
        brand: "Leapmotor",
        icon: "mdi:car-electric",
        img: "/local/pluto.png",
        ov: {
          "dm.ev_batteria_auto": "sensor.pluto_soc",
          "dm.ev_autonomia": "sensor.pluto_range",
        },
      },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }

      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        window.__BETA2_WS_CALLS__ ||= [];
        window.__BETA2_WS_CALLS__.push(structuredClone(message));
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") {
          const stored = localStorage.getItem("__beta2_remote_user_data__");
          result = { value: stored ? JSON.parse(stored) : null };
        }
        if (message.type === "frontend/set_user_data") {
          localStorage.setItem("__beta2_remote_user_data__", JSON.stringify(message.value));
        }
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

    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

async function openEditor(page, tab) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.evaluate((target) => editorSwitch(target), tab);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta2 saves EV brand/model and keeps legacy mappings`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
    await boot(page, variant, testInfo);

    await expect
      .poll(() => page.evaluate(() => DashboardModernModules.store.getSection("ev")[0]))
      .toMatchObject({
        id: "ev-pluto",
        brand: "Leapmotor",
        icon: "mdi:car-electric",
        img: "/local/pluto.png",
        ov: {
          "dm.ev_batteria_auto": "sensor.pluto_soc",
          "dm.ev_autonomia": "sensor.pluto_range",
        },
      });

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      window.dmRenderVehicleSelector?.();
    });
    const profile = page.locator("#ev-car-picker .dm-vehicle-profile-card").first();
    await expect(profile).toBeVisible();
    await expect(profile).toContainText("Pluto");
    const brandMark = profile.locator(
      '.dm-vehicle-profile-icon .dm-leapmotor-mark[data-brand="leapmotor"][data-brand-source="inline"]',
    );
    await expect(brandMark).toHaveCount(1);
    await expect(brandMark.locator("svg")).toHaveCount(1);
    await expect(
      profile.locator('.dm-vehicle-profile-icon img[data-dm-brand-image="leapmotor"]'),
    ).toHaveCount(0);
    await expect(profile.locator(".dm-vehicle-profile-icon")).not.toContainText("🚗");

    await openEditor(page, "sez2");
    const appearance = page.locator("#ed-body [data-ev-appearance]");
    await expect(appearance).toBeVisible();
    await expect(appearance.locator("select[data-brand]")).toHaveValue("Leapmotor");
    const modelSelect = appearance.locator("select[data-model]");
    await expect(modelSelect).toContainText("B10");
    await modelSelect.selectOption("B10");
    await expect(modelSelect).toHaveValue("B10");
    await appearance.locator("button[data-save]").click();

    await expect
      .poll(() => page.evaluate(() => DashboardModernModules.store.getSection("ev")[0]))
      .toMatchObject({
        id: "ev-pluto",
        brand: "Leapmotor",
        model: "B10",
        icon: "mdi:car-electric",
        img: "/local/pluto.png",
        ov: {
          "dm.ev_batteria_auto": "sensor.pluto_soc",
          "dm.ev_autonomia": "sensor.pluto_range",
        },
      });

    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.__BETA2_WS_CALLS__ || [])
            .filter((message) => message.type === "frontend/set_user_data")
            .at(-1),
        ),
      )
      .toEqual(
        expect.objectContaining({
          type: "frontend/set_user_data",
          value: expect.objectContaining({
            version: 1,
            values: expect.objectContaining({ cd_ev_cars: expect.any(String) }),
          }),
        }),
      );

    const persisted = await page.evaluate(() => {
      const remote = JSON.parse(localStorage.getItem("__beta2_remote_user_data__"));
      const car = JSON.parse(remote.values.cd_ev_cars)[0];
      return { brand: car.brand, model: car.model };
    });
    expect(persisted).toEqual({ brand: "Leapmotor", model: "B10" });
  });

  test(`${variant}: beta2 binds daily and monthly load flow animation to configured canonical loads`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(async () => {
      const state = (entity_id, value) => ({
        entity_id,
        state: String(value),
        attributes: { unit_of_measurement: "kWh" },
      });
      const seeded = [
        state("sensor.flow_boiler_day", 1.25),
        state("sensor.flow_clima_day", 0.16),
        state("sensor.flow_lav_day", 0),
        state("sensor.flow_cuc_month", 12.4),
      ];
      for (const item of seeded) {
        _RAW_STATES[item.entity_id] = structuredClone(item);
        STATES[item.entity_id] = structuredClone(item);
      }
      await DashboardModernModules.store.replaceSection("loads", [
        {
          id: "flow-boiler",
          name: "Boiler",
          order: 0,
          show_in_dashboard: true,
          daily_energy_entity: "sensor.flow_boiler_day",
        },
        { id: "flow-wallbox", name: "Wallbox", order: 1, show_in_dashboard: true },
        {
          id: "flow-clima",
          name: "Clima",
          order: 2,
          show_in_dashboard: true,
          daily_energy_entity: "sensor.flow_clima_day",
        },
        {
          id: "flow-lav",
          name: "Lavanderia",
          order: 3,
          show_in_dashboard: true,
          daily_energy_entity: "sensor.flow_lav_day",
        },
        {
          id: "flow-cuc",
          name: "Cucina",
          order: 4,
          show_in_dashboard: true,
          monthly_energy_entity: "sensor.flow_cuc_month",
        },
      ]);
      dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      await new Promise((resolve) => setTimeout(resolve, 260));
      window.dmRefreshEnergyFlows?.();
    });

    await expect(page.locator("#v-boiler-day")).toContainText(/1[,.]3|1[,.]25/);
    await expect(page.locator("#v-clima-day")).toContainText(/0[,.]2|0[,.]16/);
    await expect(page.locator("#v-cuc-month")).toContainText(/12[,.]4/);
    await expect(page.locator("#line-home-boiler-day")).toHaveClass(/active/);
    await expect(page.locator("#line-home-boiler-day")).toHaveClass(/dm-energy-flow-active/);
    await expect(page.locator("#line-home-clima-day")).toHaveClass(/active/);
    await expect(page.locator("#line-home-lav-day")).not.toHaveClass(/active/);
    await expect(page.locator("#line-home-cuc-month")).toHaveClass(/active/);

    await page.evaluate(async () => {
      _RAW_STATES["sensor.flow_boiler_day"].state = "0";
      STATES["sensor.flow_boiler_day"].state = "0";
      _RAW_STATES["sensor.flow_cuc_month"].state = "0";
      STATES["sensor.flow_cuc_month"].state = "0";
      dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      await new Promise((resolve) => setTimeout(resolve, 180));
      window.dmRefreshEnergyFlows?.();
    });
    await expect(page.locator("#line-home-boiler-day")).not.toHaveClass(/active/);
    await expect(page.locator("#line-home-cuc-month")).not.toHaveClass(/active/);
  });

  test(`${variant}: built-in quick action keeps the custom icon on save`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_quick_actions",
        JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:lightbulb" }]),
      );
      window.buildQuickActions?.();
    });

    await openEditor(page, "sez8");
    const edit = page.locator('#ed-body [data-dm-edit-kind="action"]').first();
    await expect(edit).toBeVisible();
    await edit.click();
    const modal = page.locator("#dm-action-editor-modal");
    await expect(modal).toBeVisible();
    const icon = modal.locator('input[name="icon"]');
    await expect(icon).not.toHaveAttribute("readonly", "");
    await icon.fill("mdi:star");
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toHaveCount(0);

    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_quick_actions"))[0]))
      .toMatchObject({ type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:star" });
  });
}

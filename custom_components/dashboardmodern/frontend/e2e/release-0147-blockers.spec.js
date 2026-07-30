import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const haStates = [
  { entity_id: "light.salone", state: "on", attributes: { friendly_name: "Luce salone" } },
  {
    entity_id: "cover.salone",
    state: "open",
    attributes: { friendly_name: "Tapparella salone", current_position: 65 },
  },
  {
    entity_id: "sensor.salone_temperature",
    state: "22.4",
    attributes: {
      friendly_name: "Temperatura salone",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.salone_humidity",
    state: "48",
    attributes: {
      friendly_name: "Umidità salone",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  {
    entity_id: "sensor.forno_power",
    state: "850",
    attributes: { friendly_name: "Forno power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.forno_energy",
    state: "4.2",
    attributes: {
      friendly_name: "Forno energy",
      unit_of_measurement: "kWh",
      device_class: "energy",
    },
  },
];

const dashboardSeed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "mdi:sofa",
        floor: "Terra",
        temp: "sensor.salone_temperature",
        hum: "sensor.salone_humidity",
      },
    ],
    lights: [{ id: "light-salone", name: "Luce salone", entities: ["light.salone"] }],
    appliances: [],
    loads: [],
    covers: [],
  },
  visibility: {
    home: true,
    energy: true,
    appliances: true,
    tapparelle: true,
    temp: true,
    irrigation: true,
  },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((states) => {
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
        const result =
          message.type === "get_states"
            ? states
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
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
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(
    (states) =>
      states.forEach((state) => {
        _RAW_STATES[state.entity_id] = structuredClone(state);
        STATES[state.entity_id] = structuredClone(state);
      }),
    haStates,
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__DASHBOARDMODERN_0147_FIXES__?.patched === true),
    )
    .toBe(true);
  await page.evaluate(() => window.render?.());
}

async function openEditor(page, tab) {
  if (!(await page.locator("#editor-modal").count())) {
    await page.locator(".ha-menu-btn").click();
    await page
      .locator("#cd-app-menu button", { hasText: /Configurazione|Configuration/ })
      .click();
  }
  await page.locator(`.ed-tab[data-tab="${tab}"]`).click();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: 0.14.7 blocker audit covers edit flows and real layouts`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-ipad") {
      test.slow(true, "Full visual editor audit is slower on WebKit/iPad");
    }
    await boot(page, variant, testInfo);

    await openEditor(page, "tapp");
    await page.locator("#ed-tp-name").fill("Tapparella salone");
    await page.locator("#ed-tp-ent").fill("cover.salone");
    await page.locator("#ed-tp-room").selectOption("room-salone");
    await page.locator("[data-tapp-form] .ed-btn-add").click();
    await page.locator('[data-tapp-edit="0"]').click();
    await expect(page.locator("#ed-tp-ent")).toHaveValue("cover.salone");
    await page.locator("#ed-tp-name").fill("Tapparella principale");
    await page.locator("[data-tapp-form] .ed-btn-add").click();
    await expect
      .poll(() => page.evaluate(() => getTapparelle()))
      .toEqual([
        {
          name: "Tapparella principale",
          entity: "cover.salone",
          room: "room-salone",
        },
      ]);

    await openEditor(page, "avvisi");
    await page.locator("#ed-avv-grp").selectOption("luci");
    await page.locator("#ed-avv-ent").fill("light.salone");
    await page.locator("#ed-avv-name").fill("Luce salone");
    await page.locator('button[onclick="edAddAvviso()"]:visible').click();
    await page.locator("[data-standard-alert-edit]").click();
    await expect(page.locator("#ed-avv-ent")).toHaveValue("light.salone");
    await page.locator("#ed-avv-name").fill("Luce principale");
    await page.locator('button[onclick="edAddAvviso()"]:visible').click();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          groups: JSON.parse(localStorage.getItem("cd_gruppi_extra") || "{}"),
          names: JSON.parse(localStorage.getItem("cd_avvisi_names_extra") || "{}"),
        })),
      )
      .toMatchObject({
        groups: { luci: ["light.salone"] },
        names: { "light.salone": "Luce principale" },
      });

    await openEditor(page, "irr");
    const irrigationAudit = await page.evaluate(() => {
      const ids = ["ed-irr-ent", "ed-irr-rain", "ed-irr-weather"];
      return {
        fields: document.querySelectorAll(".dm-irrigation-form [data-entity-field]").length,
        pickers: document.querySelectorAll(".dm-irrigation-form .dm-entity-picker").length,
        invalid: ids.some((id) => {
          const input = document.getElementById(id);
          return !input || /[\\\"]/.test(input.placeholder) || /[\\\"]/.test(input.value);
        }),
      };
    });
    expect(irrigationAudit).toEqual({ fields: 3, pickers: 3, invalid: false });

    await openEditor(page, "appliances");
    await page.locator("#appl-icon-btn").click();
    await page.locator("#dm-applpick button", { hasText: /Forno|Oven/i }).click();
    await page.locator("#appl-name").fill("Forno");
    await page.locator("#appl-room").selectOption("room-salone");
    for (const entity of ["sensor.forno_power", "sensor.forno_energy"]) {
      await page.locator("#appl-ent").fill(entity);
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
        visual_type: "asset",
        visual_key: "forno",
        image: "",
        image_url: "",
      });
    await page.locator("#editor-modal .ed-head-close").last().click();
    await clickBottomTab(page, "appliances", testInfo);
    await page.evaluate(() => renderApplianceSection?.(true));
    await expect(page.locator('[data-appliance-asset="forno"]')).toBeVisible();
    await expect(page.locator('.appl-wide-card img[src*="logo.png"]')).toHaveCount(0);

    await clickBottomTab(page, "temp", testInfo);
    const temperatureIcon = page.locator("#temp-grid .temp-room-icon").first();
    await expect(temperatureIcon).toHaveAttribute("data-room-icon", "mdi:sofa");
    await expect(temperatureIcon).not.toHaveText("");

    await openEditor(page, "sez1");
    await page.locator(".ed-inner-tab", { hasText: /^REPORT$/ }).click();
    const reportRow = page.locator(".dm-report-row").first();
    await expect(reportRow).toBeVisible();
    const layout = await reportRow.evaluate((row) => {
      const entity = row.querySelector("[data-entity-field]").getBoundingClientRect();
      const label = row.querySelector("[data-report-label]").getBoundingClientRect();
      const actions = row.querySelector(".dm-report-actions").getBoundingClientRect();
      const box = row.getBoundingClientRect();
      const overlap = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return {
        display: getComputedStyle(row).display,
        rowWidth: box.width,
        entityWidth: entity.width,
        labelEntityOverlap: overlap(label, entity),
        entityActionsOverlap: overlap(entity, actions),
      };
    });
    expect(layout.display).toBe("grid");
    expect(layout.entityWidth).toBeGreaterThan(180);
    expect(layout.labelEntityOverlap).toBe(0);
    expect(layout.entityActionsOverlap).toBe(0);

    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-release-0147-audit.png`,
      fullPage: true,
    });
  });
}

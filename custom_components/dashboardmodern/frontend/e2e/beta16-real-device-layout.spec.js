// DM-FIX-20260812C
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "32.8",
    attributes: {
      friendly_name: "Temperatura Cameretta",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "50",
    attributes: {
      friendly_name: "Umidità Cameretta",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  {
    entity_id: "climate.cameretta",
    state: "off",
    attributes: {
      friendly_name: "Cameretta",
      current_temperature: 32.8,
      temperature: 18,
    },
  },
  {
    entity_id: "climate.salone",
    state: "off",
    attributes: {
      friendly_name: "Salone",
      current_temperature: 32.2,
      temperature: 18,
    },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room_msqjk307",
        name: "Cameretta",
        icon: "mdi:bed",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
      },
      { id: "room_salone", name: "Salone", icon: "mdi:sofa", temp: "", hum: "" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: {
    home: true,
    temp: true,
    temperature: true,
    clima: true,
    piscina: true,
  },
};

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
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
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  }, states);

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
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
  }, states);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

test(
  "beta16: Climate resolves canonical room labels and stays two cards per row on phone",
  async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, testInfo);
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_clima_units",
        JSON.stringify([
          {
            type: "clima",
            name: "Cameretta",
            entity: "climate.cameretta",
            room: "room_msqjk307",
          },
          { type: "clima", name: "Salone", entity: "climate.salone", room: "room_salone" },
        ]),
      );
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-clima")?.classList.add("active");
      buildClimaCards();
      setClimaPageMode("freddo", true);
    });

    await expect(page.locator("#page-clima .clima-section-title").first()).toContainText(
      "Cameretta",
    );
    await expect(page.locator("#page-clima .clima-section-title").first()).not.toContainText(
      "room_msqjk307",
    );
    await expect(page.locator("#page-clima .cp-card")).toHaveCount(2);
    await expect(
      page.locator("#page-clima .cp-card .dm-beta16-climate-room").first(),
    ).toContainText("Cameretta");

    const layout = await page.evaluate(() => {
      const grid = document.querySelector("#page-clima .clima-premium-grid");
      const switchNode = document.querySelector(
        '#page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"]',
      );
      const buttons = [...(switchNode?.querySelectorAll(".clima-page-mode-btn") || [])];
      const cards = [...document.querySelectorAll("#page-clima .cp-card")].map((card) =>
        card.getBoundingClientRect(),
      );
      const gridBox = grid?.getBoundingClientRect();
      const columns = grid
        ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean)
        : [];
      const headings = [
        ...document.querySelectorAll("#page-clima .dm-beta16-climate-group-heading"),
      ];
      return {
        columns: columns.length,
        switchHeight: switchNode?.getBoundingClientRect().height || 0,
        maxButtonHeight: buttons.length
          ? Math.max(...buttons.map((button) => button.getBoundingClientRect().height))
          : 0,
        cardWidth: cards[0]?.width || 0,
        gridWidth: gridBox?.width || 0,
        sameRow: cards.length >= 2 && Math.abs(cards[0].top - cards[1].top) <= 3,
        hiddenHeadings:
          headings.length > 0 &&
          headings.every((heading) => getComputedStyle(heading).display === "none"),
        overflow: grid ? grid.scrollWidth - grid.clientWidth : 999,
      };
    });
    expect(layout.columns).toBe(2);
    expect(layout.switchHeight).toBeLessThan(75);
    expect(layout.maxButtonHeight).toBeLessThanOrEqual(60);
    expect(layout.cardWidth).toBeLessThan(layout.gridWidth * 0.55);
    expect(layout.sameRow).toBe(true);
    expect(layout.hiddenHeadings).toBe(true);
    expect(layout.overflow).toBeLessThanOrEqual(2);
  },
);

test(
  "beta16: editor rows show saved Action, Climate and Temperature names",
  async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, testInfo);
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_quick_actions",
        JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci salone", icon: "💡" }]),
      );
      localStorage.setItem(
        "cd_clima_units",
        JSON.stringify([
          {
            type: "clima",
            name: "Cameretta",
            entity: "climate.cameretta",
            room: "room_msqjk307",
          },
        ]),
      );
      buildQuickActions();
    });

    await openEditor(page, "sez8");
    const actionRow = page.locator(
      '#ed-body .ed-row:has([data-dm-edit-kind="action"][data-dm-edit-index="0"])',
    );
    await expect(actionRow).toContainText("Luci salone");

    await openEditor(page, "sez9");
    const climateRow = page.locator(
      '#ed-body .ed-row:has([data-dm-edit-kind="climate"][data-dm-edit-index="0"])',
    );
    await expect(climateRow).toContainText("Cameretta");
    await expect(climateRow).toContainText("climate.cameretta");
    await climateRow.locator('[data-dm-edit-kind="climate"]').click();
    const roomSelect = page.locator('#dm-climate-editor-modal select[name="room"]');
    await expect(roomSelect).toHaveValue("room_msqjk307");
    await expect(roomSelect.locator('option[value="room_msqjk307"]')).toContainText("Cameretta");
    await page.locator("#dm-climate-editor-modal [data-close]").click();

    await openEditor(page, "sez7");
    const temperatureRow = page.locator(
      '#ed-body [data-temperature-room][data-room-id="room_msqjk307"]',
    );
    await expect(temperatureRow).toContainText("Cameretta");
    await expect(temperatureRow).toContainText("sensor.cameretta_temperature");
    const temperatureRoom = page.locator("#dm-temperature-room");
    await expect(temperatureRoom.locator('option[value="room_msqjk307"]')).toContainText(
      "Cameretta",
    );
  },
);

test(
  "beta16: Temperature room tabs are restored and filter canonical room cards",
  async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, testInfo);
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-temp")?.classList.add("active");
      renderTemperature();
    });

    const tabs = page.locator("#dm-beta16-temperature-tabs");
    await expect(tabs).toBeVisible();
    await expect(tabs.locator('button[data-room-filter="all"]')).toContainText("Tutte");
    const cameretta = tabs.locator('button[data-room-filter="room_msqjk307"]');
    await expect(cameretta).toContainText("Cameretta");
    await expect(page.locator('#temp-grid [data-room-id="room_msqjk307"]')).toBeVisible();
    await cameretta.click();
    await expect(cameretta).toHaveClass(/active/);
    await expect(page.locator('#temp-grid [data-room-id="room_msqjk307"]')).toBeVisible();
  },
);

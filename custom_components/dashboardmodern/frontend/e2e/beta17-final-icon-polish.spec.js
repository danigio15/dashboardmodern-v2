// DM-FIX-20260813A
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room_cameretta",
        name: "Cameretta",
        icon: "mdi:bed-king-outline",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
      },
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
  },
};

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "32.7",
    attributes: {
      friendly_name: "Temperatura Cameretta",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "51",
    attributes: {
      friendly_name: "Umidità Cameretta",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
];

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

async function pickerPalette(page) {
  return page
    .locator('#dm-visual-picker[data-kind="room"] .dm-picker-option')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const glyph = button.querySelector(".dm-beta12-room-glyph");
        return {
          token: glyph?.dataset.token || "",
          glyph: glyph?.textContent?.trim() || "",
        };
      }),
    );
}

test("beta17: Temperature hides progress copy", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    renderTemperature();
  });

  const initiallyVisible = await page.evaluate(() => {
    const selector = "#page-temp div,#page-temp span,#page-temp p,#page-temp small";
    return [...document.querySelectorAll(selector)].some(
      (node) =>
        node.children.length === 0 &&
        /aggiornamento in corso/i.test(node.textContent || "") &&
        getComputedStyle(node).display !== "none" &&
        node.getClientRects().length > 0,
    );
  });
  expect(initiallyVisible).toBe(false);

  await page.evaluate(() => {
    const status = document.createElement("span");
    status.id = "beta17-late-temperature-status";
    status.textContent = "AGGIORNAMENTO IN CORSO...";
    document.getElementById("page-temp")?.prepend(status);
  });
  await expect(page.locator("#beta17-late-temperature-status")).toBeHidden();
  await expect(page.locator("#beta17-late-temperature-status")).toHaveAttribute(
    "data-dm-beta17-temperature-progress-hidden",
    "true",
  );
});

test("beta17: Action picker is colored from first mutation", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([
        { type: "builtin", builtin: "luci", name: "Luci salone", icon: "mdi:lightbulb" },
      ]),
    );
    buildQuickActions();
  });
  await openEditor(page, "sez8");
  const edit = page.locator('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index="0"]');
  await edit.click();
  const preview = page.locator("#dm-action-editor-modal [data-action-icon-preview]");
  await expect(preview).toBeVisible();
  await expect(preview.locator("svg,ha-icon")).toHaveCount(0);
  await expect(preview.locator(".dm-beta12-action-glyph")).toHaveText("💡");

  await page.evaluate(() => {
    window.__beta17PickerMutations = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element) || node.id !== "dm-visual-picker") return;
          const first = ".dm-picker-option .dm-beta12-action-glyph";
          window.__beta17PickerMutations.push({
            kind: node.getAttribute("data-kind"),
            owner: node.getAttribute("data-dm-beta17-picker"),
            svgCount: node.querySelectorAll("svg,ha-icon").length,
            firstGlyph: node.querySelector(first)?.textContent?.trim() || "",
          });
        });
      });
    });
    observer.observe(document.body, { childList: true });
    window.__beta17PickerObserver = observer;
  });

  await preview.click();
  const picker = page.locator('#dm-visual-picker[data-kind="action"]');
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-dm-beta17-picker", "action");
  await expect(picker).toHaveAttribute("data-dm-single-glyph-owner", "true");
  await expect(picker.locator("svg,ha-icon")).toHaveCount(0);
  const firstGlyph = picker.locator('.dm-picker-option[data-index="0"] .dm-beta12-action-glyph');
  await expect(firstGlyph).toHaveText("🏠");

  const mutations = await page.evaluate(() => {
    window.__beta17PickerObserver?.disconnect();
    return window.__beta17PickerMutations || [];
  });
  expect(mutations.length).toBe(1);
  expect(mutations[0]).toEqual({
    kind: "action",
    owner: "action",
    svgCount: 0,
    firstGlyph: "🏠",
  });
});

test("beta17: room add/edit share one color picker", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openEditor(page, "stanze");

  const firstInsert = page.locator("#ed-body .dm-beta5-room-icon-trigger");
  await expect(firstInsert).toBeVisible();
  await firstInsert.click();
  const firstPicker = page.locator('#dm-visual-picker[data-kind="room"]');
  await expect(firstPicker).toBeVisible();
  await expect(firstPicker).toHaveAttribute("data-dm-beta17-picker", "room");
  await expect(firstPicker.locator("header strong")).toContainText("Scegli l'icona");
  await expect(firstPicker.locator("svg,ha-icon")).toHaveCount(0);
  const firstPalette = await pickerPalette(page);
  expect(firstPalette.length).toBeGreaterThanOrEqual(20);
  await firstPicker.locator("[data-close]").click();

  const row = page.locator(
    '#ed-body .ed-row:has([data-dm-edit-kind="room"][data-dm-edit-index="0"])',
  );
  await row.locator('[data-dm-edit-kind="room"]').click();
  const roomModal = page.locator("#dm-room-editor-modal");
  await expect(roomModal).toBeVisible();
  const preview = roomModal.locator("[data-room-icon-preview]");
  await expect(preview.locator("svg,ha-icon")).toHaveCount(0);
  await expect(preview.locator(".dm-beta12-room-glyph")).toHaveText("🛏️");
  await preview.click();

  const editPicker = page.locator('#dm-visual-picker[data-kind="room"]');
  await expect(editPicker).toBeVisible();
  await expect(editPicker).toHaveAttribute("data-dm-beta17-picker", "room");
  await expect(editPicker.locator("header strong")).toContainText("Scegli l'icona");
  await expect(editPicker.locator("svg,ha-icon")).toHaveCount(0);
  const editPalette = await pickerPalette(page);
  expect(editPalette).toEqual(firstPalette);
});

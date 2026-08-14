// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-cameretta", name: "Cameretta", icon: "mdi:sofa" },
      { id: "room-bagno", name: "Bagno", icon: "mdi:shower" },
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
    irrigazione: true,
  },
};

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
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
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
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
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.DashboardModernIconEngine?.render === "function" &&
            typeof window.DashboardModernIconEngine?.syncEditor === "function",
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

async function oneVisibleGlyph(locator, className, text) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate(
        (node, args) => {
          const before = getComputedStyle(node, "::before");
          const after = getComputedStyle(node, "::after");
          const semantic = node.querySelectorAll(`:scope > .${args.className}`);
          const pseudoVisible = (style) => {
            const content = style.content || "";
            return (
              !["none", "normal", '""', "''", ""].includes(content) && style.display !== "none"
            );
          };
          return {
            children: node.children.length,
            semantic: semantic.length,
            text: semantic[0]?.textContent || "",
            before: pseudoVisible(before),
            after: pseudoVisible(after),
            svg: node.querySelectorAll("svg").length,
          };
        },
        { className },
      ),
    )
    .toEqual({
      children: 1,
      semantic: 1,
      text,
      before: false,
      after: false,
      svg: 0,
    });
}

test("beta13: Home quick action has exactly one icon even after delayed legacy repaint", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:lightbulb" }]),
    );
    buildQuickActions();
  });

  const icon = page.locator("#qa-grid .qa-btn .icon").first();
  await oneVisibleGlyph(icon, "dm-beta12-action-glyph", "💡");
  await page.waitForTimeout(1100);
  await oneVisibleGlyph(icon, "dm-beta12-action-glyph", "💡");
});

test("beta13: room rows and action picker never expose a second vector/pseudo icon", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);

  await openEditor(page, "stanze");
  const roomIcon = page
    .locator(
      '#ed-body .ed-row:has([data-dm-edit-kind="room"][data-dm-edit-index="0"]) .dm-room-list-icon',
    )
    .first();
  await oneVisibleGlyph(roomIcon, "dm-beta12-room-glyph", "🛋️");
  await page.waitForTimeout(1000);
  await oneVisibleGlyph(roomIcon, "dm-beta12-room-glyph", "🛋️");

  await page.evaluate(() => {
    localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([{ type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:lightbulb" }]),
    );
    buildQuickActions();
  });
  await openEditor(page, "sez8");
  await page.locator('#ed-body [data-dm-edit-kind="action"]').first().click();
  const preview = page.locator("#dm-action-editor-modal [data-action-icon-preview]");
  await expect(preview).toBeVisible();
  await preview.click();
  const picker = page.locator('#dm-visual-picker[data-kind="action"]');
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-dm-single-glyph-owner", "true");
  const first = picker.locator('.dm-picker-option[data-index="0"] .dm-picker-visual');
  await oneVisibleGlyph(first, "dm-beta12-action-glyph", "🏠");
  await page.waitForTimeout(1100);
  await oneVisibleGlyph(first, "dm-beta12-action-glyph", "🏠");
});

test("beta13: Temperature has no orphan icon row and Irrigation keeps a usable mobile width", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);

  await openEditor(page, "sez7");
  const form = page.locator("#editor-modal [data-temperature-form]");
  await expect(form).toBeVisible();
  expect(await form.locator("[data-icon-field]").count()).toBe(0);
  const hiddenIcon = form.locator("#dm-temperature-icon");
  await expect(hiddenIcon).toHaveCount(1);
  expect(
    await hiddenIcon.evaluate((node) => ({
      type: node.type,
      hidden: node.hidden,
      label: Boolean(node.closest("label")),
    })),
  ).toEqual({ type: "hidden", hidden: true, label: false });

  await openEditor(page, "irr");
  const irrigation = await page.evaluate(() => {
    const body = document.getElementById("ed-body");
    const input = document.getElementById("ed-irr-ent");
    if (!body || !input) return null;
    const bodyBox = body.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    return {
      bodyWidth: bodyBox.width,
      inputWidth: inputBox.width,
      overflow: body.scrollWidth - body.clientWidth,
      ratio: inputBox.width / bodyBox.width,
      inputHeight: inputBox.height,
    };
  });
  expect(irrigation).not.toBeNull();
  expect(irrigation.bodyWidth).toBeGreaterThan(330);
  expect(irrigation.inputWidth).toBeGreaterThan(220);
  expect(irrigation.ratio).toBeGreaterThan(0.55);
  expect(irrigation.inputHeight).toBeGreaterThanOrEqual(44);
  expect(irrigation.overflow).toBeLessThanOrEqual(2);
});

test("beta13: Thermostat edit persists the legacy heating type and renders in Caldo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_clima_units",
      JSON.stringify([{ type: "termostato", name: "Studio", entity: "climate.studio", room: "" }]),
    );
    buildClimaCards();
  });

  await openEditor(page, "sez9");
  const edit = page.locator('#ed-body [data-dm-edit-kind="climate"]').first();
  await expect(edit).toBeVisible();
  await edit.click();
  const modal = page.locator("#dm-climate-editor-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator('select[name="type"]')).toHaveValue("termo");
  await modal.locator('button[type="submit"]').click();
  await expect(modal).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_clima_units") || "[]")[0]?.type),
    )
    .toBe("termo");
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    buildClimaCards();
    setClimaPageMode("caldo", true);
  });
  await expect(page.locator("#page-clima .clima-zone-caldo")).toContainText("Studio");
  await expect(page.locator("#page-clima .clima-zone-caldo")).not.toContainText(
    "Nessun termosifone configurato",
  );
});

test("beta13: Pool uses equal mobile controls and keeps temperature copy clear of them", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_piscina",
      JSON.stringify({
        tempEnt: "sensor.pool_temperature",
        pumpEnt: "switch.pool_pump",
        heatEnt: "switch.pool_heat",
        lightEnt: "switch.pool_light",
        filterHours: 8,
        autoHours: true,
      }),
    );
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-piscina")?.classList.add("active");
    renderPiscina();
  });

  const hero = page.locator("#page-piscina .pool-hero");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute("data-dm-beta16-pool", "true");

  const layout = await hero.evaluate((hero) => {
    const controls = [...hero.querySelectorAll(".pool-tg[data-act]")].map((node) =>
      node.getBoundingClientRect(),
    );
    const copy = hero.querySelector(".pool-sub")?.getBoundingClientRect();
    const chips = hero.querySelector(".pool-chips")?.getBoundingClientRect();
    const widths = controls.map((box) => box.width);
    return {
      count: controls.length,
      minWidth: Math.min(...widths),
      maxWidth: Math.max(...widths),
      copyWidth: copy?.width || 0,
      separated: Boolean(copy && chips && copy.bottom <= chips.top + 1),
      overflow: hero.scrollWidth - hero.clientWidth,
    };
  });
  expect(layout.count).toBe(3);
  expect(layout.minWidth).toBeGreaterThan(90);
  expect(layout.maxWidth - layout.minWidth).toBeLessThanOrEqual(3);
  expect(layout.copyWidth).toBeGreaterThan(90);
  expect(layout.separated).toBe(true);
  expect(layout.overflow).toBeLessThanOrEqual(2);
});

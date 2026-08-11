import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-cameretta", name: "Cameretta", icon: "mdi:sofa", floor: "Primo piano" },
      { id: "room-bagno", name: "Bagno", icon: "mdi:shower" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [
      { id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10", icon: "mdi:car-electric", ov: {} },
      { id: "ev-mini", name: "Cooper Electric", brand: "MINI", model: "Cooper Electric", icon: "mdi:car-electric", ov: {} },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true, temp: true, temperature: true },
};

async function boot(page, variant, testInfo) {
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
        const result = message.type === "get_states" ? [] : message.type === "frontend/get_user_data" ? { value: null } : null;
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id: message.id, type: "result", success: true, result }) }));
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
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true)).toBe(true);
  await page.evaluate((cars) => {
    localStorage.setItem("cd_ev_cars", JSON.stringify(cars));
    localStorage.setItem("cd_ev_car_active", "0");
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
  }, seed.sections.ev);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta11 keeps EV logo proportional and follows the active vehicle`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);
    await openEditor(page, "sez2");

    const panel = page.locator("#ed-body [data-ev-appearance]");
    const brand = panel.locator("select[data-brand]");
    const model = panel.locator("select[data-model]");
    await expect(panel).toBeVisible();
    await expect(brand).toHaveValue("Leapmotor");
    await expect(model).toHaveValue("B10");
    await expect(panel.locator("[data-brand-preview]")).toContainText("Leapmotor");
    await expect(panel.locator("[data-brand-preview]")).toContainText("B10");

    const leapGeometry = await panel.locator("[data-brand-preview]").evaluate((preview) => {
      const logo = preview.querySelector(".dm-leapmotor-mark,.dm-car-brand");
      const art = logo?.querySelector("svg,img");
      const logoBox = logo?.getBoundingClientRect();
      const artBox = art?.getBoundingClientRect();
      const copyBox = preview.querySelector(".dm-ev-brand-copy")?.getBoundingClientRect();
      return {
        logoWidth: logoBox?.width || 0,
        logoHeight: logoBox?.height || 0,
        artWidth: artBox?.width || 0,
        artHeight: artBox?.height || 0,
        separated: Boolean(logoBox && copyBox && logoBox.right <= copyBox.left + 1),
        overflow: getComputedStyle(preview).overflow,
      };
    });
    expect(leapGeometry.logoWidth).toBeGreaterThan(50);
    expect(leapGeometry.logoWidth).toBeLessThanOrEqual(112);
    expect(leapGeometry.logoHeight).toBeLessThanOrEqual(50);
    expect(leapGeometry.artWidth).toBeLessThanOrEqual(112);
    expect(leapGeometry.artHeight).toBeLessThanOrEqual(50);
    expect(leapGeometry.separated).toBe(true);
    expect(leapGeometry.overflow).toBe("hidden");

    await page.evaluate(() => {
      localStorage.setItem("cd_ev_car_active", "1");
      window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
    });
    await expect(brand).toHaveValue("MINI");
    await expect(model).toHaveValue("Cooper Electric");
    await expect(panel).toHaveAttribute("data-dm-beta11-vehicle-index", "1");
    await expect(panel.locator("[data-brand-preview]")).toContainText("MINI");
    await expect(panel.locator("[data-brand-preview]")).toContainText("Cooper Electric");
  });

  test(`${variant}: beta11 restores configured room name/icon and expands alert icons`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await openEditor(page, "stanze");
    const row = page.locator('#ed-body .dm-beta11-room-row:has([data-dm-edit-index="0"])').first();
    await expect(row).toBeVisible();
    const name = row.locator('.ed-row-new[data-dm-room-name="true"]');
    await expect(name).toBeVisible();
    await expect(name).toHaveText("Cameretta");
    await expect(name).toHaveCSS("opacity", "1");
    await expect(row.locator('.dm-room-list-icon[data-room-icon="mdi:sofa"]')).toBeVisible();
    await expect(row.locator(".dm-room-list-icon svg")).toHaveCount(1);
    const roomGeometry = await row.evaluate((node) => {
      const label = node.querySelector(".ed-row-new");
      const icon = node.querySelector(".dm-room-list-icon");
      const labelBox = label?.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();
      return {
        labelWidth: labelBox?.width || 0,
        iconWidth: iconBox?.width || 0,
        separated: Boolean(labelBox && iconBox && iconBox.right <= labelBox.left + 1),
        color: label ? getComputedStyle(label).color : "",
      };
    });
    expect(roomGeometry.labelWidth).toBeGreaterThan(80);
    expect(roomGeometry.iconWidth).toBeGreaterThanOrEqual(50);
    expect(roomGeometry.separated).toBe(true);
    expect(roomGeometry.color).not.toBe("rgba(0, 0, 0, 0)");

    await openEditor(page, "avvisi");
    const group = page.locator("#ed-avv-grp");
    await group.selectOption("custom");
    await expect(page.locator("#ed-avv-custom")).toBeVisible();
    const alertInput = page.locator("#ed-avv-icon");
    const alertPreview = page.locator(".dm-beta11-alert-preview");
    await expect(alertPreview).toBeVisible();
    await alertPreview.click();
    const picker = page.locator("#dm-beta11-alert-picker");
    await expect(picker).toBeVisible();
    expect(await picker.locator(".dm-beta11-alert-option").count()).toBeGreaterThanOrEqual(35);
    await picker.locator('.dm-beta11-alert-option[data-alert-icon="🚨"]').click();
    await expect(alertInput).toHaveValue("🚨");
    await expect(alertPreview).toHaveText("🚨");
  });
}
import { expect, test } from "@playwright/test";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: missing Chart.js still reaches legacy readiness`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(`${error.message}\n${error.stack || ""}`));
    await page.route("https://**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await page.addInitScript(() => {
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        send() {}
        close() {}
      };
    });
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ === true && document.readyState !== "loading",
    );
    await expect(
      page.locator('[role="alert"]', {
        hasText: "Errore durante il caricamento di DashboardModern",
      }),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test(`${variant}: runtime, energy, loads and report use the shipped module`, async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(90_000);
    const errors = [];
    const pageErrors = [];
    const seedState = {
      schema_version: 3,
      sections: {
        rooms: [],
        appliances: [
          {
            id: "appliance-seed",
            name: "Seed washer",
            device_type: "lavatrice",
            show_in_report: true,
            report_label: "Washer first",
            report_icon: "🧺",
            report_entity: "sensor.washer_month",
            report_order: 0,
          },
        ],
        loads: [
          {
            id: "load-seed",
            name: "Seed pump",
            category: "secondary",
            show_in_report: true,
            report_label: "Pump second",
            report_icon: "💧",
            report_entity: "sensor.pump_month",
            report_order: 1,
          },
          {
            id: "manual-seed",
            name: "Seed manual",
            category: "manual-report",
            show_in_report: true,
            show_in_dashboard: false,
            report_label: "Manual third",
            report_icon: "🔌",
            report_entity: "sensor.manual_month",
            report_order: 2,
          },
        ],
        entityOverrides: {
          "dm.lavatrice_potenza_presa": "sensor.washer_power",
        },
      },
      visibility: {},
    };

    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    let rejectEarlyPageError;
    const earlyPageError = new Promise((_, reject) => {
      rejectEarlyPageError = reject;
    });
    page.on("pageerror", (error) => {
      const detail = [error.message, error.stack || "Stack unavailable", `URL: ${page.url()}`].join(
        "\n",
      );
      pageErrors.push(detail);
      rejectEarlyPageError(new Error(`Page error before runtime readiness:\n${detail}`));
    });
    await page.route("https://**", async (route) => {
      const url = route.request().url();
      if (url.includes("chart.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.Chart=class{static defaults={color:'',font:{}};constructor(){}destroy(){}}",
        });
      if (url.includes("panzoom"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.panzoom=()=>({dispose(){}})",
        });
      if (url.includes("hls.js"))
        return route.fulfill({
          contentType: "application/javascript",
          body: "window.Hls=class{static isSupported(){return false}}",
        });
      return route.fulfill({ status: 200, body: "" });
    });
    await page.addInitScript(() => {
      class TestSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() => {
            this.dispatchEvent(new Event("open"));
            this.onopen?.();
            this.emit({ type: "auth_required", ha_version: "test" });
          });
        }
        emit(value) {
          const event = new MessageEvent("message", { data: JSON.stringify(value) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        send(payload) {
          const message = JSON.parse(payload);
          if (message.type === "auth") this.emit({ type: "auth_ok", ha_version: "test" });
          else this.emit({ id: message.id, type: "result", success: true, result: [] });
        }
        close() {}
      }
      window.WebSocket = TestSocket;
    });

    // Seed only the canonical snapshot. Writing cd_entity_overrides after the
    // first page load would trigger the legacy write bridge and overwrite this
    // fixture with the already-initialized empty store before reload.
    await page.goto(`/legacy/${variant}`);
    await page.evaluate((state) => {
      localStorage.clear();
      localStorage.setItem("dm_dashboard_state", JSON.stringify(state));
    }, seedState);
    await page.reload();

    await Promise.race([
      page.waitForFunction(
        () =>
          window.__DASHBOARDMODERN_LEGACY_READY__ === true &&
          !!window.DashboardModernModules &&
          document.readyState !== "loading",
      ),
      earlyPageError,
    ]);
    await expect(
      page.locator('[role="alert"]', {
        hasText: "Errore durante il caricamento di DashboardModern",
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        ED_DEVICES.map((device) => [device.name, device.icon, device.sensor]),
      ),
    ).toEqual([
      ["Washer first", "🧺", "sensor.washer_month"],
      ["Pump second", "💧", "sensor.pump_month"],
      ["Manual third", "🔌", "sensor.manual_month"],
    ]);
    expect(
      await page.evaluate(() => {
        const state = window.DashboardModernModules.store.getState();
        const washer = state.sections.appliances.filter((item) => item.device_type === "lavatrice");
        return {
          schema: state.schema_version,
          count: washer.length,
          visual: [washer[0]?.visual_type, washer[0]?.visual_key],
        };
      }),
    ).toEqual({ schema: 4, count: 1, visual: ["asset", "lavatrice"] });
    expect(await page.evaluate(() => ED_DEVICES.some((item) => item.name === "Wallbox"))).toBe(
      false,
    );
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await expect(page.locator("#setup-wizard")).toHaveCount(0);
    await page.evaluate(() => {
      window.cdSyncPush = async () => {};
    });
    await expect(page.locator("#ed-modal")).toHaveCount(0);
    await page.evaluate(() => window.apriConfigEntita());
    await expect(page.locator('.ed-tab[data-tab="runtime"]')).toHaveCount(1);
    await page.locator('.ed-tab[data-tab="runtime"]').click();
    await expect(page.locator("[data-runtime-diagnostics] .ed-row")).toHaveCount(11);
    await expect(page.locator("[data-runtime-diagnostics]")).toContainText("Integration version");
    await page.evaluate(() => window.editorSwitch("sez1"));
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-energy.png` });
    const assertPickerInvariant = async () => {
      const counts = await page.locator("#ed-body").evaluate((body) => ({
        inputs: [...body.querySelectorAll("[data-entity-input]")].filter(
          (input) => input.getClientRects().length > 0,
        ).length,
        pickers: [...body.querySelectorAll(".dm-entity-picker")].filter(
          (button) => button.getClientRects().length > 0,
        ).length,
        uniqueTargets: new Set(
          [...body.querySelectorAll(".dm-entity-picker")]
            .filter((button) => button.getClientRects().length > 0)
            .map((button) => button.dataset.entityTarget),
        ).size,
      }));
      expect(counts.pickers).toBe(counts.inputs);
      expect(counts.uniqueTargets).toBe(counts.inputs);
    };
    await assertPickerInvariant();
    await page.getByRole("button", { name: /IMPOSTAZIONI|SETTINGS/ }).click();
    await page.getByRole("button", { name: /FLUSSI ED ENTITÀ|FLOWS & ENTITIES/ }).click();
    await assertPickerInvariant();
    await page.evaluate(() => window.editorSwitch("sez2"));
    await assertPickerInvariant();
    await page.locator("#ed-body").evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });
    await expect(page.locator("#ed-body")).toHaveJSProperty(
      "scrollTop",
      await page.locator("#ed-body").evaluate((body) => body.scrollTop),
    );
    expect(
      await page.locator("#ed-body").evaluate((body) => body.scrollWidth <= body.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-ev-bottom.png`,
    });
    await page.evaluate(() => window.editorSwitch("sez1"));
    const housePower = page.locator('[data-energy-panel="flows"] input').first();
    await housePower.fill("sensor.house_power");
    await housePower.blur();
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "dirty");
    await page.locator("[data-energy-save]").click();
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "success");
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /FLUSSI ED ENTITÀ|FLOWS & ENTITIES/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /CARICHI|LOADS/ }).click();
    const loads = await page.locator('[data-energy-panel="loads"]').innerHTML();
    await page.locator("#dm-load-name").fill("Booster");
    await page.locator("#dm-load-power").fill("sensor.pump_power");
    await page.locator("#dm-load-dashboard").uncheck();
    await page.locator("[data-save-load]").click();
    await expect(
      page.locator('[data-energy-panel="loads"] [data-load-id]', { hasText: "Booster" }),
    ).toHaveCount(1);
    await page
      .locator('[data-energy-panel="loads"] [data-load-id]', { hasText: "Booster" })
      .locator("[data-edit-load]")
      .click();
    await page.locator("#dm-load-name").fill("Booster updated");
    await page.locator("[data-save-load]").click();
    await expect(
      page.locator('[data-energy-panel="loads"] [data-load-id]', { hasText: "Booster updated" }),
    ).toHaveCount(1);
    await page.locator("#dm-load-name").fill("Temporary load");
    await page.locator("#dm-load-power").fill("sensor.temporary_power");
    await page.locator("[data-save-load]").click();
    const temporary = page.locator('[data-energy-panel="loads"] [data-load-id]', {
      hasText: "Temporary load",
    });
    await temporary.locator("[data-delete-load]").click();
    await expect(temporary).toHaveCount(0);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-loads.png` });
    await page.getByRole("button", { name: "REPORT" }).click();
    const report = await page.locator('[data-energy-panel="report"]').innerHTML();
    expect(report).not.toBe(loads);
    expect(report).toMatch(/Salva Report|Save Report/);
    expect(report).not.toContain("dm-load-category");
    await page.locator("[data-report-add]").click();
    await page.locator("[data-manual-name]").fill("Manual water");
    await page.locator("#dm-manual-report-icon").fill("💧");
    await page.locator("#dm-manual-report-entity").fill("sensor.water_month");
    await page.locator("#dm-manual-report-history").fill("sensor.water_total");
    await page.locator("[data-manual-confirm]").click();
    const manual = page.locator(".dm-report-row").last();
    await expect(manual.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await expect(manual.locator(".dm-entity-picker")).toHaveCount(2);
    await expect(manual.locator(".dm-icon-picker")).toHaveCount(1);
    await expect(manual.locator("[data-report-up]")).toHaveCount(1);
    await expect(manual.locator("[data-report-down]")).toHaveCount(1);
    await expect(manual.locator("[data-report-delete]")).toHaveCount(1);
    const firstReport = page.locator(".dm-report-row").first();
    await firstReport.locator("[data-report-toggle]").check();
    await firstReport.locator("[data-report-label]").fill("Canonical label");
    await firstReport.locator("[data-entity-field] input").first().fill("sensor.canonical_month");
    await page.locator("[data-report-save]").click();
    await expect(page.locator("[data-report-actions]")).toHaveAttribute("data-state", "success");
    await expect(page.locator('[data-energy-panel="report"]')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          window.DashboardModernModules.store
            .getSection("loads")
            .find((item) => item.name === "Booster updated")?.show_in_dashboard,
      ),
    ).toBe(false);
    await page.getByRole("button", { name: /CARICHI|LOADS/ }).click();
    await page.getByRole("button", { name: "REPORT" }).click();
    await expect(page.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-report.png` });
    expect(
      await page.evaluate(() => ED_DEVICES.map((device) => [device.name, device.sensor])),
    ).toContainEqual(["Canonical label", "sensor.canonical_month"]);
    await expect(
      page.locator('#ed-dev-selector option[value="sensor.canonical_month"]'),
    ).toContainText("Canonical label");
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("dm_dashboard_state")).schema_version,
      ),
    ).toBe(4);
    await page.evaluate(() => window.editorSwitch("stanze"));
    await page.locator('#ed-body button[title="Selettore icone"]').click();
    await expect(page.locator("#dm-icon-grid button")).toHaveCount(19);
    for (const icon of ["🛏️", "🛋️", "🍳", "🛁", "💻", "🚗", "🌇", "🧺"])
      await expect(page.locator("#dm-icon-grid button", { hasText: icon })).toHaveCount(1);
    await page.locator("#dm-icon-search").fill("camera");
    await expect(page.locator("#dm-icon-grid button", { hasText: "🛏️" })).toHaveCount(1);
    await page.locator("#dm-icon-search").fill("bedroom");
    await expect(page.locator("#dm-icon-grid button", { hasText: "🛏️" })).toHaveCount(1);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-room-picker.png`,
    });
    await page
      .locator("#dm-iconpick")
      .getByRole("button", { name: /CHIUDI|CLOSE/ })
      .click();
    await page.evaluate(() => window.editorSwitch("luci"));
    await assertPickerInvariant();
    await expect(page.locator("#luce-add-ent")).toHaveAttribute("data-entity-input", "true");
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-lights.png` });
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("luci"));
    await assertPickerInvariant();

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderApplianceSection(true);
    });
    const applianceCards = page.locator("#appl-grid-overview .appl-wide-card");
    await expect(applianceCards).toHaveCount(1);
    await expect(applianceCards.first().locator(".appl-ic svg, .appl-ic img")).toHaveCount(1);
    expect(
      await applianceCards
        .first()
        .locator(".appl-ic")
        .evaluate(
          (visual) =>
            visual.getBoundingClientRect().width > 0 &&
            visual.getBoundingClientRect().height > 0 &&
            !!visual.querySelector("svg,img"),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-appliances.png`,
    });
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

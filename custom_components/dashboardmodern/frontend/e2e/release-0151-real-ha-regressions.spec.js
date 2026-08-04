import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab } from "./helpers/navigation.js";

async function openEditor(page, tab) {
  await page.evaluate((targetTab) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(targetTab);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: 0.15.1 restores real HA theme, totals, flows, temperature and alerts`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 110_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    await page.evaluate(() => {
      document.documentElement.style.setProperty("--dm-bg", "#f0f4f8");
      document.documentElement.style.setProperty("--bg-sculpted", "#f0f4f8");
      document.documentElement.style.setProperty("--card-bg", "#071728");
      document.documentElement.style.setProperty("--ha-card-background", "#071728");
      document.documentElement.style.setProperty("--primary-text-color", "#ffffff");
      window.__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__?.apply?.();
      window.__DASHBOARDMODERN_REAL_HA_THEME_OWNER_0151__?.apply?.();
    });

    await clickBottomTab(page, "appliances", testInfo);
    const appliance = page
      .locator("#page-appliances-main .appl-wide-card")
      .filter({ hasText: /Frigo|Fridge/i })
      .first();
    await expect(appliance).toBeVisible();
    await expect(appliance).toHaveCSS("background-color", "rgb(248, 250, 252)");
    await expect(appliance.locator(".appl-wide-name")).toHaveCSS("color", "rgb(15, 23, 42)");
    const applianceToggle = appliance.locator('[data-dm-power-toggle="true"],.dm-appliance-power-toggle').first();
    if (await applianceToggle.count()) {
      await expect(applianceToggle).toHaveCSS("border-radius", "12px");
      await expect(applianceToggle).toHaveCSS("color", "rgb(255, 255, 255)");
    }

    await page.evaluate(() => {
      const room = DashboardModernModules.store.getSection("rooms").find((item) => item.temp);
      const entity = room?.temp;
      if (!entity) throw new Error("No configured temperature entity in the real-HA fixture");
      const current = STATES[entity] || {
        entity_id: entity,
        state: "0",
        attributes: { unit_of_measurement: "°C", friendly_name: room.name },
      };
      STATES[entity] = { ...structuredClone(current), state: "35.4" };
      _RAW_STATES[entity] = structuredClone(STATES[entity]);
      buildTempCards?.();
      renderTemperature?.();
      window.__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__?.apply?.();
    });
    await clickBottomTab(page, "temperature", testInfo);
    const temperatureCard = page.locator("#temp-grid .temp-card").first();
    await expect(temperatureCard).toContainText("35.4");
    await expect(temperatureCard).not.toContainText("🔥");

    await page.evaluate(() => {
      const runtime = window.__DASHBOARDMODERN_RUNTIME_0150__;
      runtime.bundle.month = {
        house: 413.9,
        solar: 288.8,
        gridImport: 222,
        gridExport: 5.8,
        batteryCharged: 27,
        batteryDischarged: 136,
      };
      DashboardModernRuntime0150.applyBundle(runtime.bundle);
      document.getElementById("v-home-month").textContent = "614.0 kWh";
      document.getElementById("v-solar-month").textContent = "999.0 kWh";
      window.dispatchEvent(new CustomEvent("dashboardmodern:period-bundle", { detail: runtime.bundle }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:energy-periods-0154"));
    });
    await expect(page.locator("#v-home-month")).toContainText(/413[,.]9/);
    await expect(page.locator("#v-home-month")).not.toContainText("614");
    await expect(page.locator("#v-solar-month")).toContainText(/288[,.]8/);
    await expect(page.locator("#v-grid-month")).toContainText(/222[,.]0/);
    await expect(page.locator("#v-grid-month")).toContainText(/5[,.]8/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/413[,.]9/);
    await expect(page.locator("#ed-yoy-chips")).toContainText(/413[,.]9/);

    await openEditor(page, "sez1");
    const housePower = page.locator("#dm-energy-house-power");
    await housePower.fill("sensor.house_power");
    await housePower.dispatchEvent("input");
    const houseDetails = housePower.locator("xpath=ancestor::details[1]");
    await expect(houseDetails.locator("summary")).toContainText(/2\/5/);
    await expect(page.locator("#dm-energy-house-total_energy")).toHaveValue("sensor.house_total");
    await page.locator("[data-energy-save]").click();
    await expect
      .poll(() => page.evaluate(() => DashboardModernModules.store.getSection("energy").house))
      .toMatchObject({ power: "sensor.house_power", total_energy: "sensor.house_total" });

    await page.evaluate(() => {
      const alertState = {
        entity_id: "light.real_alert",
        state: "on",
        attributes: { friendly_name: "Avviso reale salone" },
      };
      STATES[alertState.entity_id] = structuredClone(alertState);
      _RAW_STATES[alertState.entity_id] = structuredClone(alertState);
      localStorage.setItem("cd_gruppi_extra", JSON.stringify({ luci: [alertState.entity_id] }));
      localStorage.setItem(
        "cd_avvisi_names_extra",
        JSON.stringify({ [alertState.entity_id]: "Avviso reale salone" }),
      );
      window.__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__?.synchronizeAlertRegistries?.();
      window.__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__?.refreshAlerts?.();
      window.render?.();
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const groups = window.eval(
            'typeof GRUPPI_MONITORAGGIO !== "undefined" ? GRUPPI_MONITORAGGIO : {}',
          );
          return groups.luci || [];
        }),
      )
      .toContain("light.real_alert");

    await openEditor(page, "avvisi");
    const alertEdit = page.locator(
      '[data-alert-edit-0151][data-alert-entity="light.real_alert"]',
    );
    await expect(alertEdit).toBeVisible();
    await alertEdit.click();
    await expect(page.locator("#ed-avv-ent")).toHaveValue("light.real_alert");
    await page.locator("#ed-avv-name").fill("Avviso salone modificato");
    await page.locator('button[onclick="edAddAvviso()"]:visible').click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("cd_avvisi_names_extra") || "{}")[
            "light.real_alert"
          ],
        ),
      )
      .toBe("Avviso salone modificato");
  });
}

import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { clickBottomTab, clickStableButton } from "./helpers/navigation.js";

async function openEnergyAnalysis(page, testInfo) {
  await clickBottomTab(page, "energy", testInfo);
  const energyPage = page.locator("#page-energy.active");
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /^📊?\s*(Report)$/i }),
    testInfo,
  );
  await expect(page.locator("#view-panoramica")).toBeVisible();
  await clickStableButton(
    page,
    energyPage.getByRole("button", { name: /Analisi|Analysis/i }),
    testInfo,
  );
  await expect(page.locator("#ed-pane-analisi")).toBeVisible();
}

async function openEditor(page, tab) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.evaluate((target) => editorSwitch(target), tab);
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: weekly Home analysis and editor polish match the mobile contracts`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 120_000);
    await bootConsolidatedDashboard(page, variant, testInfo);
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));

    await openEnergyAnalysis(page, testInfo);
    const weekly = page.locator("#ed-pane-analisi .ed-weekly-card");
    await expect(weekly).toHaveAttribute("data-dm-weekly-ready", "true");
    await expect(weekly).toHaveAttribute("data-dm-weekly-source", "home-assistant-flow-balance");
    await expect(weekly.locator(".ed-weekly-title")).toContainText(
      variant.includes("-en") ? /Home consumption/i : /Consumi Casa/i,
    );
    await expect(page.locator("#ed-w-prev-val")).toContainText(/\d+[,.]\d\s*kWh/);
    await expect(page.locator("#ed-w-curr-val")).toContainText(/\d+[,.]\d\s*kWh/);
    await expect(page.locator("#ed-w-prev-val")).not.toContainText("—");
    await expect(page.locator("#ed-w-curr-val")).not.toContainText("—");
    await expect(weekly.locator(".dm-weekly-delta")).toBeVisible();

    await openEditor(page, "sez1");
    const guide = page.locator("#editor-modal .dm-energy-source-guide");
    await expect(guide.locator(".dm-energy-guide-steps>span")).toHaveCount(3);
    await expect(guide).toContainText(
      variant.includes("-en") ? /total kWh meter/i : /contatore totale kWh/i,
    );
    await expect(guide).toContainText(
      variant.includes("-en") ? /Home Assistant balance/i : /bilancio Home Assistant/i,
    );
    expect(
      await guide.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);

    await openEditor(page, "appliances");
    await page.evaluate(() => edApplEdit(2));
    const applianceModal = page.locator("#dm-appliance-editor-modal");
    await expect(applianceModal).toBeVisible();
    const typeSelect = applianceModal.locator('select[name="icon"]');
    const preview = applianceModal.locator("[data-icon-preview]");

    // The fixture is named Microonde and intentionally stores the historical
    // English alias visual_key="microwave". Edit must reopen on the canonical
    // Microonde option and show the exact SVG used by the public card.
    await expect(typeSelect).toHaveValue("microonde");
    await expect(preview).toHaveAttribute("data-dm-preview-source", "artwork");
    await expect(preview.locator('.dm-appliance-art[data-dm-art="microwave"]')).toHaveCount(1);
    await expect(preview.locator("svg")).toHaveCount(1);
    await expect(preview.locator(".dm-appliance-menu-glyph")).toHaveCount(0);

    await typeSelect.selectOption("lavastoviglie");
    await typeSelect.dispatchEvent("input");
    await typeSelect.dispatchEvent("change");
    await expect(preview).toHaveAttribute("data-dm-preview-source", "artwork");
    await expect(preview.locator('.dm-appliance-art[data-dm-art="dishwasher"]')).toHaveCount(1);
    await expect(preview.locator("svg")).toHaveCount(1);
    await expect(preview.locator(".dm-appliance-menu-glyph")).toHaveCount(0);
    await applianceModal.locator("[data-close]").click();

    await page.evaluate(() => {
      localStorage.setItem(
        "cd_luci",
        JSON.stringify({
          "light.cucina_1": "Pensile",
          "light.cucina_2": "Tavolo",
          "light.cucina_3": "Lavello",
          "light.cucina_4": "Cappa",
        }),
      );
      localStorage.setItem(
        "cd_luci_rooms",
        JSON.stringify({
          "light.cucina_1": "room-salone",
          "light.cucina_2": "room-salone",
          "light.cucina_3": "room-salone",
          "light.cucina_4": "room-salone",
        }),
      );
    });
    await openEditor(page, "luci");
    const lightRows = page.locator("#editor-modal .dm-light-row");
    await expect(lightRows).toHaveCount(4);
    const firstLight = lightRows.first();
    await expect(firstLight.locator(".dm-light-room")).toBeVisible();
    await expect(firstLight.locator(".dm-light-edit")).toBeVisible();
    await expect(firstLight.locator(".dm-light-delete")).toBeVisible();
    expect(
      await page.locator("#ed-body").evaluate((body) => body.scrollWidth <= body.clientWidth + 1),
    ).toBe(true);
    if ((page.viewportSize()?.width || 1000) <= 720) {
      const geometry = await firstLight.evaluate((node) => ({
        areas: getComputedStyle(node).gridTemplateAreas,
        height: node.getBoundingClientRect().height,
      }));
      expect(geometry.areas).toContain("main edit delete");
      expect(geometry.areas).toContain("room room room");
      expect(geometry.height).toBeLessThan(210);
    }

    await openEditor(page, "sez7");
    const temperatureForm = page.locator("#editor-modal [data-temperature-form]");
    await expect(temperatureForm).toHaveAttribute("data-dm-temperature-mode", "add");
    await expect(temperatureForm.locator("[data-temperature-submit]")).toHaveText(
      variant.includes("-en") ? "ASSOCIATE SENSORS" : "ASSOCIA SENSORI",
    );
    const configuredTemperature = page.locator("#editor-modal [data-temperature-room]").first();
    await expect(configuredTemperature).toBeVisible();
    await configuredTemperature.locator("[data-temperature-edit]").click();
    await expect(temperatureForm).toHaveAttribute("data-dm-temperature-mode", "edit");
    await expect(temperatureForm.locator("[data-temperature-submit]")).toHaveText(
      variant.includes("-en") ? "SAVE CHANGES" : "SALVA MODIFICHE",
    );
    await expect(temperatureForm.locator("[data-temperature-cancel]")).toBeVisible();
    expect(
      await page.locator("#ed-body").evaluate((body) => body.scrollWidth <= body.clientWidth + 1),
    ).toBe(true);
  });
}

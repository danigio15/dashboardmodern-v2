import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Phase 6 Energy, appliances and mobile layout`, async ({ page }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await bootConsolidatedDashboard(page, variant, testInfo);
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("sez1"));
    const config = page.locator('#ed-body[data-renderer="energy"]');
    await expect(config).toBeVisible();
    for (const label of variant.includes("-en")
      ? ["Power", "Daily", "Monthly", "Annual", "Total energy meter"]
      : ["Potenza", "giornaliera", "mensile", "annuale", "Contatore energia totale"]) {
      await expect(config).toContainText(new RegExp(label, "i"));
    }
    await expect(config.locator("details.ed-acc")).toHaveCount(6);
    if (testInfo.project.name === "mobile")
      await page.screenshot({ path: `test-results/${variant}-config-energy-mobile.png`, fullPage: true });

    await page.evaluate(() => {
      document.getElementById("ed-modal")?.remove();
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderApplianceSection(true);
    });
    const cards = page.locator("#page-appliances-main .appl-wide-card[data-appliance-id]");
    await expect(cards.filter({ hasText: variant.includes("-en") ? "RUNNING" : "IN FUNZIONE" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "STANDBY" })).toHaveCount(1);
    await expect(cards.filter({ hasText: variant.includes("-en") ? "OFF" : "SPENTO" })).toHaveCount(3);
    const noHistory = cards.filter({ hasText: "Ventola" });
    await expect(noHistory.getByRole("button", { name: /Storico|History/ })).toBeDisabled();
    const statuses = await cards.locator(".appl-st").allTextContents();
    const normalized = await cards.locator("[data-appliance-state]").allTextContents();
    expect(normalized.every((label) => statuses.some((status) => status.includes(label)))).toBeTruthy();
    if (testInfo.project.name === "mobile") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: `test-results/${variant}-appliances-mobile.png`, fullPage: true });
    }

    await page.evaluate(() => window.switchTab("energy"));
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.month?.house === 39.9);
    await expect(page.locator("#ed-kpi-cons")).toContainText("39.9");
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-energy-monthly.png`, fullPage: true });
    expect(await page.evaluate(() => window.__dmStatisticsRequests.every((request) => request.types?.includes("sum")))).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

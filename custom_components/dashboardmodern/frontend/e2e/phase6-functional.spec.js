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
    await expect(config.locator('input[name="battery.soc"]')).toBeAttached();
    await expect(config).toContainText(variant.includes("-en") ? /State of charge/i : /Stato di carica/i);
    const sourceGroups = config.locator('details.ed-acc:has([data-energy-total-field="true"])');
    await expect(sourceGroups).toHaveCount(6);
    await expect(page.locator("#editor-modal .dm-energy-source-guide")).toBeVisible();

    // Energy-specific guidance must not leak into Alerts or any other top-level
    // editor section, which was visible in the real 0.15.10 screenshot.
    await page.evaluate(() => window.editorSwitch("avvisi"));
    await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "avvisi");
    await expect(page.locator("#editor-modal .dm-energy-source-guide")).toHaveCount(0);
    await expect(page.locator("#editor-modal .dm-energy-help-compact:visible")).toHaveCount(0);
    await page.evaluate(() => window.editorSwitch("sez1"));
    await expect(config).toBeVisible();

    if (testInfo.project.name === "mobile")
      await page.screenshot({ path: `test-results/${variant}-config-energy-mobile.png`, fullPage: true });

    // Leave the editor through the real UI instead of deleting its DOM node.
    // The real modal is #editor-modal; the old #ed-modal selector never closed it.
    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toBeHidden();

    // Trigger the real navigation buttons through their DOM click handler. The
    // sidebar can intentionally sit outside the viewport (desktop/mobile/touch),
    // so a pointer click is not a stable cross-project contract here.
    await page.locator('.tab[data-tab="appliances-main"]').evaluate((button) => button.click());
    await page.evaluate(() => window.renderApplianceSection(true));

    // Appliance cards are rendered in multiple sub-views (overview/room/other).
    // Only the active sub-view is visible to the user; scope assertions to it so
    // duplicate cards in hidden views do not inflate status counts.
    const cards = page.locator("#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id]");
    await expect(cards.filter({ hasText: variant.includes("-en") ? "RUNNING" : "IN FUNZIONE" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "STANDBY" })).toHaveCount(2);
    await expect(cards.filter({ hasText: variant.includes("-en") ? "OFF" : "SPENTO" })).toHaveCount(2);

    const microwave = page.locator(
      '#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id="appl-microwave"]',
    );
    await expect(microwave).toContainText("0 W");
    await expect(microwave.locator("[data-appliance-state]")).toContainText("STANDBY");
    await expect(microwave.locator('[data-dm-power-toggle="true"]')).toBeVisible();
    // The old icon-only toggle may remain in legacy markup for compatibility,
    // but it must not be visible beside the modern Accendi/Spegni control.
    await expect(microwave.locator(".appl-action-btn").first()).toBeHidden();

    const noHistory = page.locator(
      '#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id="appl-no-history"]',
    );
    await expect(noHistory).toHaveCount(1);
    await expect(noHistory.getByRole("button", { name: /Storico|History/ })).toBeDisabled();
    const statuses = await cards.locator(".appl-st").allTextContents();
    const normalized = await cards.locator("[data-appliance-state]").allTextContents();
    expect(normalized.every((label) => statuses.some((status) => status.includes(label)))).toBeTruthy();
    if (testInfo.project.name === "mobile") {
      const mobileContentFits = await page.evaluate(() => {
        const viewport = innerWidth;
        const nodes = [
          document.querySelector("#page-appliances-main"),
          document.querySelector("#page-appliances-main .appl-main-view.active"),
          ...document.querySelectorAll(
            "#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id]",
          ),
        ].filter(Boolean);
        return nodes.every((node) => {
          const rect = node.getBoundingClientRect();
          return rect.left >= -2 && rect.right <= viewport + 2;
        });
      });
      expect(mobileContentFits).toBeTruthy();
      await page.screenshot({ path: `test-results/${variant}-appliances-mobile.png`, fullPage: true });
    }

    await page.locator('.tab[data-tab="energy"]').evaluate((button) => button.click());
    // The fixture deliberately reports 28.2 kWh from the direct Home meter but
    // 39.9 kWh from the same flow balance used by Home Assistant. The browser
    // must show the reconciled value, not the direct meter.
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.month?.house === 39.9);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/39[,.]9/);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-energy-monthly.png`, fullPage: true });
    expect(await page.evaluate(() => window.__dmStatisticsRequests.every((request) => request.types?.includes("sum")))).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

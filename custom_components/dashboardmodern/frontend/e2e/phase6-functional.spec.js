// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";
import { editEntityFieldByHand } from "./helpers/entity-field.js";

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
    await expect(config).toContainText(
      variant.includes("-en") ? /State of charge/i : /Stato di carica/i,
    );
    const sourceGroups = config.locator('details.ed-acc:has([data-energy-total-field="true"])');
    await expect(sourceGroups).toHaveCount(6);
    await expect(page.locator("#editor-modal .dm-energy-source-guide")).toBeVisible();

    // The real report screenshot showed cards wider than the editor modal. Open
    // the Report tab and enforce the browser geometry instead of only checking CSS.
    const reportButton = config.getByRole("button", { name: /^REPORT$/i });
    await reportButton.click();
    const reportPanel = page.locator('#editor-modal [data-energy-panel="report"]');
    await expect(reportPanel).toBeVisible();
    await expect(reportPanel.locator(".dm-report-row").first()).toBeVisible();
    expect(
      await page.evaluate(() => {
        const modal =
          document.querySelector("#editor-modal .ed-shell") ||
          document.querySelector("#editor-modal");
        const rows = [
          ...document.querySelectorAll('#editor-modal [data-energy-panel="report"] .dm-report-row'),
        ];
        if (!modal || !rows.length) return false;
        const bounds = modal.getBoundingClientRect();
        return rows.every((row) => {
          const rect = row.getBoundingClientRect();
          return rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2;
        });
      }),
    ).toBeTruthy();

    // Return to the main flow/entity sub-tab before switching top-level editor
    // sections, so the Energy guide is mounted in its normal context.
    const flowButton = config
      .getByRole("button", {
        name: variant.includes("-en") ? /FLOW|ENTIT/i : /FLUSSI|ENTIT/i,
      })
      .first();
    await flowButton.click();
    await expect(page.locator("#editor-modal .dm-energy-source-guide")).toBeVisible();

    // Energy-specific guidance must not leak into Alerts or any other top-level
    // editor section, which was visible in the real 0.15.10 screenshot.
    await page.evaluate(() => window.editorSwitch("avvisi"));
    await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute(
      "data-tab",
      "avvisi",
    );
    await expect(page.locator("#editor-modal .dm-energy-source-guide")).toHaveCount(0);
    await expect(page.locator("#editor-modal .dm-energy-help-compact:visible")).toHaveCount(0);

    // Real 0.15.16 mobile regression: the appliance editor's width:100% inputs
    // lived beside fixed icon/picker buttons in flex rows. The resulting min
    // content width pushed the green/blue full-width actions off the viewport.
    await page.evaluate(() => window.editorSwitch("appliances"));
    await expect(page.locator("#appl-name")).toBeVisible();
    await expect(page.locator("#appl-room")).toBeVisible();
    // The entity field is one readable row now; the pencil brings the id back.
    await expect(page.locator("#appl-ent ~ .dm-entity-picker.dm-slot-chip")).toBeVisible();
    await editEntityFieldByHand(page, "#appl-ent");
    await expect(page.locator("#appl-ent")).toBeVisible();
    if (testInfo.project.name === "mobile") {
      const applianceEditorGeometry = await page.evaluate(() => {
        const shell = document.querySelector("#editor-modal .ed-shell");
        const body = document.querySelector("#editor-modal #ed-body");
        if (!shell || !body) return [{ target: "missing-shell-or-body" }];
        const bounds = shell.getBoundingClientRect();
        const viewport = innerWidth;
        const nodes = [
          body,
          ...body.querySelectorAll(
            ".ed-list,.ed-row,.ed-form,.ed-form-row,.ed-btn-add,#appl-name,#appl-room,#appl-ent",
          ),
        ];
        return nodes
          .filter(
            (node) =>
              node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden",
          )
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              target: node.id
                ? `#${node.id}`
                : `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}`,
              left: Math.round(rect.left * 10) / 10,
              right: Math.round(rect.right * 10) / 10,
              width: Math.round(rect.width * 10) / 10,
              shellLeft: Math.round(bounds.left * 10) / 10,
              shellRight: Math.round(bounds.right * 10) / 10,
              viewport,
            };
          })
          .filter(
            (item) =>
              item.left < item.shellLeft - 2 ||
              item.right > item.shellRight + 2 ||
              item.left < -2 ||
              item.right > viewport + 2,
          );
      });
      await page.screenshot({
        path: `test-results/${variant}-config-appliances-mobile.png`,
        fullPage: true,
      });
      expect(applianceEditorGeometry).toEqual([]);
    }

    await page.evaluate(() => window.editorSwitch("sez1"));
    await expect(config).toBeVisible();
    if (testInfo.project.name === "mobile")
      await page.screenshot({
        path: `test-results/${variant}-config-energy-mobile.png`,
        fullPage: true,
      });

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
    // duplicate cards in hidden views do not inflate status counts. Use the
    // canonical card state marker rather than free text: in English the power
    // action "Turn off" must never be mistaken for an OFF device state.
    const cardSelector =
      "#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id]";
    const cards = page.locator(cardSelector);
    await expect(page.locator(`${cardSelector}[data-appliance-state="running"]`)).toHaveCount(1);
    await expect(page.locator(`${cardSelector}[data-appliance-state="standby"]`)).toHaveCount(2);
    await expect(page.locator(`${cardSelector}[data-appliance-state="off"]`)).toHaveCount(2);

    const microwave = page.locator(
      '#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id="appl-microwave"]',
    );
    await expect(microwave).toContainText("0 W");
    await expect(microwave).toHaveAttribute("data-appliance-state", "standby");
    await expect(microwave.locator(".dm-ap-badge")).toContainText("STANDBY");
    await expect(microwave.locator('[data-dm-power-toggle="true"]')).toBeVisible();
    // The old icon-only toggle may remain in legacy markup for compatibility,
    // but it must not be visible beside the modern Accendi/Spegni control.
    await expect(microwave.locator(".appl-action-btn").first()).toBeHidden();

    // The real hosted popup used a REST request with LONG_LIVED_TOKEN and showed
    // "Errore caricamento storico". The canonical owner must use the already
    // authenticated Home Assistant WebSocket and render the returned history.
    await microwave.getByRole("button", { name: /Storico|History/ }).click();
    const historyModal = page.locator("#history-modal");
    await expect(historyModal).toHaveClass(/show/);
    await expect(historyModal).toHaveAttribute("data-dm-history-transport", "websocket");
    await expect(historyModal).toHaveAttribute("data-dm-history-entity", "sensor.microwave_power");
    await expect(historyModal).toHaveAttribute("data-dm-history-loaded", "true");
    await expect(page.locator("#hist-canvas-container")).toBeVisible();
    await expect(page.locator("#hist-loading")).not.toContainText(/Errore|Error/i);
    expect(
      await page.evaluate(() =>
        window.__dmHistoryRequests.some(
          (request) =>
            request.type === "history/history_during_period" &&
            request.entity_ids?.includes("sensor.microwave_power"),
        ),
      ),
    ).toBeTruthy();
    await page.evaluate(() => window.forceClose("history-modal"));

    const noHistory = page.locator(
      '#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-id="appl-no-history"]',
    );
    await expect(noHistory).toHaveCount(1);
    await expect(noHistory.getByRole("button", { name: /Storico|History/ })).toBeDisabled();
    const normalizedStates = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.applianceState).sort(),
    );
    expect(normalizedStates).toEqual(["off", "off", "running", "standby", "standby"]);
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
      await page.screenshot({
        path: `test-results/${variant}-appliances-mobile.png`,
        fullPage: true,
      });
    }

    await page.locator('.tab[data-tab="energy"]').evaluate((button) => button.click());
    // Report and Monthly share the canonical Home Assistant flow boundary.
    // Direct Home is 28.2 kWh, but complete flows balance to 39.9 kWh.
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.month?.house === 39.9,
    );
    await expect(page.locator("#ed-kpi-cons")).toContainText(/39[,.]9/);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-energy-monthly.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() =>
        window.__dmStatisticsRequests.every((request) => request.types?.includes("sum")),
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

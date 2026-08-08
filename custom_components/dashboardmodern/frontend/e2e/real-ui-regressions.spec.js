import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

async function clickStableButton(page, locator, testInfo) {
  if (testInfo.project.name === "webkit-ipad") {
    await locator.evaluate((node) => node.click());
    return;
  }
  await locator.click();
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real UI regressions stay fixed`, async ({ page }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 100_000);
    await bootConsolidatedDashboard(page, variant, testInfo);

    await page.evaluate(() => {
      window.__haCalls = [];
      window.dmCallHaService = async (domain, service, service_data) => {
        window.__haCalls.push({ type: "call_service", domain, service, service_data });
      };
    });

    await page.evaluate(async () => {
      await window.DashboardModernModules.store.replaceSection("rooms", [
        { id: "room-salone", name: "Salone", icon: "🛋️", order: 0 },
      ]);
      await window.DashboardModernModules.store.replaceSection("covers", [
        { id: "cover-salone", name: "Tapparella salone", entity: "cover.salone", room_id: "room-salone", order: 0 },
        { id: "cover-cucina", name: "Tapparella cucina", entity: "cover.cucina", room_id: "room-salone", order: 1 },
      ]);
      STATES["cover.salone"] = {
        entity_id: "cover.salone",
        state: "open",
        attributes: { friendly_name: "Tapparella salone", current_position: 65 },
      };
      STATES["cover.cucina"] = {
        entity_id: "cover.cucina",
        state: "closed",
        attributes: { friendly_name: "Tapparella cucina", current_position: 0 },
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "cover.salone", entity_ids: ["cover.salone"], state: STATES["cover.salone"] },
      }));
    });

    const shutter = page.locator("#tapp-avvisi .dm-shutter-alert");
    await expect(shutter).toHaveCount(1);
    await expect(shutter).toBeVisible();
    const glance = page.locator("#glance-luci");
    const styles = await Promise.all(
      [glance, shutter].map((target) =>
        target.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            borderRadius: style.borderRadius,
            padding: style.padding,
            display: style.display,
            alignItems: style.alignItems,
            boxShadow: style.boxShadow,
          };
        }),
      ),
    );
    expect(styles[1].borderRadius).toBe(styles[0].borderRadius);
    expect(styles[1].padding).toBe(styles[0].padding);
    expect(styles[1].display).toBe(styles[0].display);
    expect(styles[1].alignItems).toBe(styles[0].alignItems);
    expect(styles[0].boxShadow).not.toBe("none");
    expect(styles[1].boxShadow).not.toBe("none");
    await shutter.click();
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await page.waitForTimeout(2600);
    await expect(page.locator("#tapp-avvisi .dm-shutter-alert")).toHaveCount(1);
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await expect(page.locator("#dm-shutter-popup")).toContainText("Tapparella salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("Salone");
    await expect(page.locator("#dm-shutter-popup")).toContainText("65%");
    const close = page.locator('[data-shutter-service="close_cover"]').first();
    await clickStableButton(page, close, testInfo);
    await expect
      .poll(() => page.evaluate(() => window.__haCalls.at(-1)))
      .toMatchObject({
        type: "call_service",
        domain: "cover",
        service: "close_cover",
        service_data: { entity_id: "cover.salone" },
      });
    await expect(close).toBeDisabled();
    await expect(close).toHaveText(/Chiusura…|Closing…/);
    await page.waitForTimeout(2600);
    await expect(close).toBeDisabled();
    await expect(close).toHaveText(/Chiusura…|Closing…/);
    await expect(page.locator("#dm-shutter-popup")).toBeVisible();
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-shutter-popup.png`,
    });
    await page.evaluate(() => {
      STATES["cover.salone"].state = "opening";
      STATES["cover.salone"].attributes.current_position = 25;
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "cover.salone", entity_ids: ["cover.salone"], state: STATES["cover.salone"] },
      }));
    });
    await expect(page.locator("#dm-shutter-popup")).toContainText("25%");
    await page.evaluate(() => {
      for (const id of ["cover.salone", "cover.cucina"]) {
        STATES[id].state = "closed";
        STATES[id].attributes.current_position = 0;
      }
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", {
        detail: {
          entity_id: "cover.cucina",
          entity_ids: ["cover.salone", "cover.cucina"],
          state: STATES["cover.cucina"],
        },
      }));
    });
    await expect(shutter).toHaveCount(0);
    await expect(page.locator("#dm-shutter-popup")).toHaveCount(0);
  });
}

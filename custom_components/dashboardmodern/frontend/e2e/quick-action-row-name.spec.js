import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

// Screenshot-proven regression: an already configured quick action showed only
// its icon and the edit/delete buttons. The label box kept the zero width the
// legacy flex rows carry, which collapses on the grid row of the action list,
// so the configured name never reached the screen.
const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
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
  visibility: { home: true },
};

const actions = [
  { type: "luci_group", name: "Luci salone", icon: "mdi:lightbulb-group", lights: ["light.a"] },
  { type: "builtin", builtin: "clima", name: "", icon: "mdi:snowflake" },
];

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

async function openActionsEditor(page, configured) {
  await page.evaluate((seeded) => {
    localStorage.setItem("cd_quick_actions", JSON.stringify(seeded));
    window.buildQuickActions?.();
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez8");
  }, configured);
  await expect(page.locator("#editor-modal")).toBeVisible();
}

test("a configured quick action shows its name in the editor list", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 80_000);
  await boot(page, testInfo);
  await openActionsEditor(page, actions);

  const rows = page.locator('#ed-body .ed-row:has([data-dm-edit-kind="action"])');
  await expect(rows).toHaveCount(actions.length);
  // The owned row layout is the one the screenshot showed: icon, label, edit, bin.
  await expect(rows.nth(0)).toHaveClass(/dm-beta7-action-row/);

  const label = rows.nth(0).locator(".ed-row-main .ed-row-new");
  await expect(label).toHaveText("Luci salone");
  await expect(label).toBeVisible();
  const labelBox = await label.boundingBox();
  expect(labelBox?.width || 0).toBeGreaterThan(80);

  // An action saved without a name still gets a readable label instead of an
  // empty row.
  const fallback = rows.nth(1).locator(".ed-row-main .ed-row-new");
  await expect(fallback).not.toHaveText("");
  const fallbackBox = await fallback.boundingBox();
  expect(fallbackBox?.width || 0).toBeGreaterThan(80);

  // The label must stay inside the row, left of the edit and delete buttons.
  const rowBox = await rows.nth(0).boundingBox();
  const editBox = await rows.nth(0).locator('[data-dm-edit-kind="action"]').boundingBox();
  expect(labelBox.x).toBeGreaterThanOrEqual(rowBox.x);
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(editBox.x + 1);
});

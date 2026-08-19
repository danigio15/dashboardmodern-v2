import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
const base = {
  rooms: [],
  cameras: [],
  appliances: [],
  loads: [],
  lights: [],
  ev: [],
  covers: [],
  pool: {},
  irrigation: { zones: [] },
  energy: {},
  entityOverrides: {},
};
const seedFor = (climate) => ({
  schema_version: 4,
  sections: { ...base, climate },
  visibility: { clima: true },
});
async function tabs(page) {
  return page.evaluate(() => {
    const shell = document.querySelector("#page-clima .dm-cl-shell");
    const sw = shell?.querySelector(".clima-page-mode-switch");
    const seen = (n) => Boolean(n) && n.getClientRects().length > 0;
    return {
      switchVisible: seen(sw),
      // With one zone left the whole switch goes, so a tab is reported by what
      // it was marked, not by whether the hidden switch lets it paint.
      freddo: shell?.querySelector('[data-dm-cl-zone="freddo"]')?.dataset.dmClEmpty !== "true",
      caldo: shell?.querySelector('[data-dm-cl-zone="caldo"]')?.dataset.dmClEmpty !== "true",
      cards: shell?.querySelectorAll(".clima-zone.show .dm-cl-card").length || 0,
      zone: shell?.dataset.dmClZone || "",
    };
  });
}
async function open(page, testInfo, climate) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seedFor(climate));
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    window.render?.();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector("#page-clima .dm-cl-shell")),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(900);
}
test("only cooling configured: no Caldo tab, no switch", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await open(page, testInfo, [{ entity: "climate.salone", name: "Salone", type: "clima" }]);
  await expect
    .poll(() => tabs(page))
    .toMatchObject({ freddo: true, caldo: false, switchVisible: false, zone: "freddo" });
  expect((await tabs(page)).cards, "the visible zone is not empty").toBeGreaterThan(0);
});
test("only heating configured: opens on Caldo", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await open(page, testInfo, [{ entity: "climate.termo", name: "Termo", type: "termo" }]);
  await expect
    .poll(() => tabs(page))
    .toMatchObject({ freddo: false, caldo: true, switchVisible: false, zone: "caldo" });
  expect((await tabs(page)).cards, "the visible zone is not empty").toBeGreaterThan(0);
});
test("both configured: both tabs and the switch", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await open(page, testInfo, [
    { entity: "climate.salone", name: "Salone", type: "clima" },
    { entity: "climate.termo", name: "Termo", type: "termo" },
  ]);
  await expect
    .poll(() => tabs(page))
    .toMatchObject({ freddo: true, caldo: true, switchVisible: true });
});

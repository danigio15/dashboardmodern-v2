import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { revealBottomNavigation, waitForStableBox } from "./helpers/navigation.js";

// Screenshot-proven regression: with every section enabled the desktop dock is
// wider than the screen. It is fixed and centered, so the page scroll never
// moves it and the last sections stayed off screen with no way to reach them.
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

const SECTION_KEYS = [
  "home",
  "energy",
  "appliances",
  "ev",
  "boiler",
  "clima",
  "temp",
  "security",
  "server",
  "tapparelle",
  "irrigazione",
  "piscina",
];

async function bootWithEverySectionVisible(page, testInfo, viewport) {
  await page.setViewportSize(viewport);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((n) => n.remove()));
  await page.evaluate((keys) => {
    localStorage.setItem(
      "cd_sections",
      JSON.stringify(Object.fromEntries(keys.map((key) => [key, true]))),
    );
    window.cdApplyNavVis?.();
    document.querySelectorAll(".tab[data-tab]").forEach((tab) => {
      tab.style.removeProperty("display");
    });
  }, SECTION_KEYS);
  // The scroll port belongs to the modular runtime, which boots after the
  // legacy bar is already on screen.
  await expect(page.locator("nav.tabs.bottom-nav-bar .dm-nav-scroll")).toBeAttached();
}

const portMetrics = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector("nav.tabs.bottom-nav-bar");
    const port = nav.querySelector(".dm-nav-scroll");
    const tabs = [...nav.querySelectorAll(".tab")].filter(
      (tab) => getComputedStyle(tab).display !== "none",
    );
    const last = tabs.at(-1).getBoundingClientRect();
    const box = port.getBoundingClientRect();
    return {
      display: getComputedStyle(port).display,
      canScroll: nav.classList.contains("dm-nav-can-scroll"),
      scrollLeft: Math.round(port.scrollLeft),
      overflow: port.scrollWidth - port.clientWidth,
      lastTab: tabs.at(-1).dataset.tab,
      lastTabVisible: last.left >= box.left - 2 && last.right <= box.right + 2,
    };
  });

// The dock slides in and out on hover, and a bar that is mid-transition is not
// a stable click target. The shipped "barra fissa" mode pins it open, which is
// the same layout with the animation out of the way.
async function pinDock(page) {
  const nav = page.locator("nav.tabs.bottom-nav-bar");
  await page.evaluate(() => document.body.classList.add("cd-nav-fixed"));
  await waitForStableBox(nav);
  await expect
    .poll(async () => {
      const box = await nav.boundingBox();
      return Math.round((await page.evaluate(() => window.innerHeight)) - box.y - box.height);
    })
    .toBe(18);
  return nav;
}

test("the desktop dock scrolls to the sections that do not fit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the scroll port is the fine-pointer layout");
  test.setTimeout(80_000);
  await bootWithEverySectionVisible(page, testInfo, { width: 1180, height: 800 });
  const nav = await pinDock(page);

  const start = await portMetrics(page);
  expect(start.display).toBe("flex");
  expect(start.canScroll).toBe(true);
  expect(start.overflow).toBeGreaterThan(0);
  expect(start.lastTabVisible).toBe(false);

  const previous = page.locator(".dm-nav-arrow-prev");
  const next = page.locator(".dm-nav-arrow-next");
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect.poll(async () => (await portMetrics(page)).lastTabVisible).toBe(true);
  await expect(previous).toBeEnabled();

  // The vertical wheel of a plain mouse is the only scroll gesture a desktop
  // always has, so over the dock it has to move it sideways.
  const box = await nav.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1200);
  await expect.poll(async () => (await portMetrics(page)).scrollLeft).toBe(0);
  await expect(previous).toBeDisabled();

  // Dragging the bar scrolls it and must not land on the tab under the pointer.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await portMetrics(page)).scrollLeft).toBeGreaterThan(0);
  await expect(page.locator("#page-home")).toHaveClass(/active/);

  // Scrolling must not cost a click: the tabs still switch page.
  const tab = page.locator('.tab[data-tab="clima"]');
  await tab.click();
  await expect(page.locator("#page-clima")).toHaveClass(/active/);
});

test("the touch bar keeps the scrolling it already had", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "covers the coarse-pointer layout");
  test.setTimeout(120_000);
  await bootWithEverySectionVisible(page, testInfo, { width: 390, height: 844 });
  await revealBottomNavigation(page);

  const metrics = await portMetrics(page);
  expect(metrics.display).toBe("contents");
  expect(metrics.canScroll).toBe(false);
  await expect(page.locator(".dm-nav-arrow-next")).toBeHidden();
  const navOverflow = await page.evaluate(() => {
    const nav = document.querySelector("nav.tabs.bottom-nav-bar");
    return nav.scrollWidth - nav.clientWidth;
  });
  expect(navOverflow).toBeGreaterThan(0);
});

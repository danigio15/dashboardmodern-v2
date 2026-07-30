import { expect } from "@playwright/test";

export async function waitForStableBox(locator) {
  let previous = null;
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) {
          previous = null;
          stableSamples = 0;
          return false;
        }
        const current = [box.x, box.y, box.width, box.height];
        if (previous && current.every((value, index) => Math.abs(value - previous[index]) <= 1))
          stableSamples += 1;
        else stableSamples = 0;
        previous = current;
        return stableSamples >= 2;
      },
      { timeout: 3000, intervals: [50, 100, 150] },
    )
    .toBeTruthy();
}

export async function revealBottomNavigation(page, projectName) {
  const nav = page.locator("nav.bottom-nav-bar");
  const touch = projectName === "mobile" || projectName === "webkit-ipad";
  if (touch) {
    const handle = page.locator("#bottomNavHandle");
    await expect(handle).toBeVisible();
    if (!(await nav.getAttribute("class"))?.includes("visible")) await handle.click();
    await expect(nav).toHaveClass(/visible/);
    return "touch";
  }

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is unavailable");
  await page.mouse.move(Math.floor(viewport.width / 2), viewport.height - 1);
  await expect
    .poll(async () => {
      const box = await nav.boundingBox();
      return Boolean(box && box.y >= 0 && box.y + box.height <= viewport.height);
    })
    .toBeTruthy();
  const navBox = await nav.boundingBox();
  if (!navBox) throw new Error("Desktop navigation has no bounding box");
  await page.mouse.move(navBox.x + 4, navBox.y + 4);
  await waitForStableBox(nav);
  return "mouse";
}

export async function clickBottomTab(page, tabName, projectName) {
  const mode = await revealBottomNavigation(page, projectName);
  const tab = page.locator(`.tab[data-tab="${tabName}"]`);
  await tab.scrollIntoViewIfNeeded();
  await expect(tab).toBeVisible();
  await waitForStableBox(tab);
  const box = await tab.boundingBox();
  if (!box) throw new Error(`${tabName} tab has no box`);
  if (mode === "touch") {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect(tab).toHaveClass(/active/);
  await expect(page.locator(`#page-${tabName}`)).toHaveClass(/active/);
}

export async function clickStableButton(page, locator, projectName) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  await waitForStableBox(locator);
  const box = await locator.boundingBox();
  if (!box) throw new Error("Button has no bounding box");
  if (projectName === "mobile" || projectName === "webkit-ipad")
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

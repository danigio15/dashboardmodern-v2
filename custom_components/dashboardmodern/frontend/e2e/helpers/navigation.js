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

export async function revealBottomNavigation(page) {
  const nav = page.locator("nav.bottom-nav-bar");
  const handle = page.locator("#bottomNavHandle");
  if (await handle.isVisible()) {
    if (!(await nav.getAttribute("class"))?.includes("visible")) await handle.click();
    await expect(nav).toHaveClass(/visible/);
    return "handle";
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

export async function clickBottomTab(page, tabName) {
  const mode = await revealBottomNavigation(page);
  const tab = page.locator(`.tab[data-tab="${tabName}"]`);
  await tab.scrollIntoViewIfNeeded();
  await expect(tab).toBeVisible();
  if (mode === "handle") {
    await tab.click();
  } else {
    const initialBox = await tab.boundingBox();
    if (!initialBox) throw new Error(`${tabName} tab has no box`);
    await page.mouse.move(
      initialBox.x + initialBox.width / 2,
      initialBox.y + initialBox.height / 2,
    );
    await waitForStableBox(tab);
    const stableBox = await tab.boundingBox();
    if (!stableBox) throw new Error(`${tabName} tab disappeared`);
    await page.mouse.move(stableBox.x + stableBox.width / 2, stableBox.y + stableBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
  }
  await expect(tab).toHaveClass(/active/);
  await expect(page.locator(`#page-${tabName}`)).toHaveClass(/active/);
}

export async function clickStableButton(_page, locator, _testInfo) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

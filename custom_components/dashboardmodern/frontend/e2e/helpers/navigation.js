import { expect } from "@playwright/test";

export async function waitForStableBox(locator) {
  let previous = null;
  let stableSamples = 0;
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      if (!box) {
        previous = null;
        stableSamples = 0;
        return false;
      }
      const current = [box.x, box.y, box.width, box.height].map(Math.round);
      if (previous && current.every((value, index) => value === previous[index]))
        stableSamples += 1;
      else stableSamples = 0;
      previous = current;
      return stableSamples >= 3;
    })
    .toBeTruthy();
}

export async function revealBottomNavigation(page) {
  const nav = page.locator("nav.bottom-nav-bar");
  const handle = page.locator("#bottomNavHandle");
  if (await handle.isVisible()) {
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

export async function clickBottomTab(page, tabName) {
  const mode = await revealBottomNavigation(page);
  const tab = page.locator(`.tab[data-tab="${tabName}"]`);
  await tab.scrollIntoViewIfNeeded();
  await expect(tab).toBeVisible();
  await waitForStableBox(tab);
  if (mode === "touch") {
    await tab.click();
    return;
  }
  const box = await tab.boundingBox();
  if (!box) throw new Error(`Bottom tab ${tabName} has no bounding box`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export async function clickStableButton(page, locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  await waitForStableBox(locator);
  const box = await locator.boundingBox();
  if (!box) throw new Error("Button has no bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

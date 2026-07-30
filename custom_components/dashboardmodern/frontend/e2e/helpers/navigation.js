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

async function instantScrollIntoView(locator) {
  await locator.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  });
}

export async function clickBottomTab(page, tabName, testInfo) {
  const touchProject =
    testInfo.project.name === "mobile" || testInfo.project.name === "webkit-ipad";
  const nav = page.locator("nav.bottom-nav-bar");
  const tab = page.locator(`.tab[data-tab="${tabName}"]`);
  if (touchProject) {
    const handle = page.locator("#bottomNavHandle");
    await expect(handle).toBeVisible();
    if (!(await nav.getAttribute("class"))?.includes("visible")) await handle.click();
    await expect(nav).toHaveClass(/visible/);
    await instantScrollIntoView(tab);
    const box = await tab.boundingBox();
    if (!box) throw new Error(`${tabName} touch tab has no bounding box`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await revealBottomNavigation(page);
    await expect(tab).toBeVisible();
    await tab.focus();
    await expect(tab).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(tab).toHaveClass(/active/);
  await expect(page.locator(`#page-${tabName}`)).toHaveClass(/active/);
}

export async function clickStableButton(page, locator, testInfo) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  if (testInfo.project.name === "webkit-ipad") {
    await instantScrollIntoView(locator);
    const box = await locator.boundingBox();
    if (!box) throw new Error("WebKit button has no box");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    return;
  }
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

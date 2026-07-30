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

async function tapTouchNavigationTab(page, nav, handle, tab, tabName) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (!(await nav.getAttribute("class"))?.includes("visible"))
        await handle.tap({ timeout: 2500 });
      await expect(nav).toHaveClass(/visible/, { timeout: 1500 });
      await instantScrollIntoView(tab);
      await waitForStableBox(tab);
      await tab.tap({ timeout: 3000 });
      await expect(tab).toHaveClass(/active/, { timeout: 1500 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  const diagnostics = await tab.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const element = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      rect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      hitTag: element?.tagName || null,
      hitClass: element?.className || null,
      hitTab: element?.closest(".tab")?.dataset.tab || null,
      navClass: node.closest("nav.bottom-nav-bar")?.className || null,
    };
  });
  throw new Error(`Unable to activate ${tabName}: ${JSON.stringify(diagnostics)}; ${lastError}`);
}

async function activateApplianceRuntime(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    const appliancePage = document.getElementById("page-appliances-main");
    if (!appliancePage) throw new Error("Appliance runtime page is unavailable");
    appliancePage.classList.add("active");
    window.renderApplianceSection?.(true);
  });
  await expect(page.locator("#page-appliances-main")).toHaveClass(/active/);
}

export async function clickBottomTab(page, tabName, testInfo) {
  // Appliances are a dedicated runtime page reached from Energy, not a navbar tab.
  // Activate the real page for visual runtime tests instead of inventing a fake tab.
  if (tabName === "appliances") {
    await activateApplianceRuntime(page);
    return;
  }

  const touchProject =
    testInfo.project.name === "mobile" || testInfo.project.name === "webkit-ipad";
  const nav = page.locator("nav.bottom-nav-bar");
  const tab = page.locator(`.tab[data-tab="${tabName}"]`);
  if (touchProject) {
    const handle = page.locator("#bottomNavHandle");
    await expect(handle).toBeVisible();
    await tapTouchNavigationTab(page, nav, handle, tab, tabName);
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

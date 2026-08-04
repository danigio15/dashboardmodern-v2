import { expect } from "@playwright/test";

export async function waitForStableBox(locator) {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return Boolean(box && box.width > 0 && box.height > 0);
    }, { timeout: 3000, intervals: [40, 80, 120] })
    .toBeTruthy();
}

export async function revealBottomNavigation(page) {
  const nav = page.locator("nav.bottom-nav-bar");
  const handle = page.locator("#bottomNavHandle");
  if (await handle.isVisible()) {
    if (!(await nav.getAttribute("class"))?.includes("visible")) {
      await handle.evaluate((node) => node.click());
    }
    await expect(nav).toHaveClass(/visible/);
    return "handle";
  }

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is unavailable");
  await page.mouse.move(Math.floor(viewport.width / 2), Math.max(0, viewport.height - 1));
  await nav.evaluate((node) => {
    node.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  });
  await waitForStableBox(nav);
  return "mouse";
}

async function instantScrollIntoView(locator) {
  await locator.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  });
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
  if (tabName === "appliances") {
    await activateApplianceRuntime(page);
    return;
  }

  const runtimeTab = tabName === "temperature" ? "temp" : tabName;
  const nav = page.locator("nav.bottom-nav-bar");
  const tab = page.locator(`.tab[data-tab="${runtimeTab}"]`);
  const touchProject = testInfo.project.name === "mobile" || testInfo.project.name === "webkit-ipad";

  if (touchProject) {
    const handle = page.locator("#bottomNavHandle");
    await expect(handle).toBeVisible();
    if (!(await nav.getAttribute("class"))?.includes("visible")) {
      await handle.evaluate((node) => node.click());
    }
    await expect(nav).toHaveClass(/visible/);
  } else {
    await revealBottomNavigation(page);
  }

  await instantScrollIntoView(tab);
  await waitForStableBox(tab);
  await tab.evaluate((node) => node.click());
  await expect(tab).toHaveClass(/active/);
  await expect(page.locator(`#page-${runtimeTab}`)).toHaveClass(/active/);
}

export async function clickStableButton(page, locator, testInfo) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await instantScrollIntoView(locator);
  await waitForStableBox(locator);
  if (testInfo.project.name === "webkit-ipad") {
    await locator.evaluate((node) => node.click());
    return;
  }
  await locator.click();
}

// DM-FIX-20260812B
import { expect } from "@playwright/test";

export async function waitForStableBox(locator) {
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        return Boolean(box && box.width > 0 && box.height > 0);
      },
      { timeout: 3000, intervals: [40, 80, 120] },
    )
    .toBeTruthy();
}

/* La barra puo' essere gia' fuori: adesso e' cosi' che parte la plancia, e la
 * maniglia per tirarla fuori in quel caso non c'e' — non c'e' niente da tirare.
 * Il mestiere di questi aiutanti e' renderla raggiungibile, non farla uscire per
 * forza. */
async function barraGiaFuori(nav) {
  return nav.evaluate((nodo) => {
    if (document.body?.classList.contains("cd-nav-fixed")) return true;
    const riquadro = nodo.getBoundingClientRect();
    return riquadro.top < window.innerHeight - 1 && getComputedStyle(nodo).opacity !== "0";
  });
}

async function revealTouchNavigation(page, nav, handle) {
  if (await barraGiaFuori(nav)) {
    await waitForStableBox(nav);
    return;
  }
  await expect(handle).toBeVisible();
  if (!(await nav.getAttribute("class"))?.includes("visible")) {
    await handle.evaluate((node) => node.click());
  }

  await nav.evaluate((node) => {
    document.body?.classList.add("nav-visible");
    node.classList.add("visible");
  });
  await waitForStableBox(nav);
}

export async function revealBottomNavigation(page) {
  const nav = page.locator("nav.bottom-nav-bar");
  const handle = page.locator("#bottomNavHandle");
  if (await barraGiaFuori(nav)) {
    await waitForStableBox(nav);
    return "gia-fuori";
  }
  if (await handle.isVisible()) {
    await revealTouchNavigation(page, nav, handle);
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
  const touchProject =
    testInfo.project.name === "mobile" || testInfo.project.name === "webkit-ipad";

  if (touchProject) {
    await revealTouchNavigation(page, nav, page.locator("#bottomNavHandle"));
  } else {
    await revealBottomNavigation(page);
  }

  await instantScrollIntoView(tab);
  await waitForStableBox(tab);
  await tab.evaluate((node) => node.click());
  await expect(tab).toHaveClass(/active/);
  await expect(page.locator(`#page-${runtimeTab}`)).toHaveClass(/active/);

  if (runtimeTab === "temp") {
    const firstCard = page.locator("#temp-grid .temp-card").first();
    await expect(firstCard).toBeAttached();
    await waitForStableBox(firstCard);
  }
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

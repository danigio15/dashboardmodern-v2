import { expect, test } from "@playwright/test";

async function bootDashboard(page, variant) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://**", async (route) => {
    const url = route.request().url();
    if (url.includes("chart.js")) {
      return route.fulfill({
        contentType: "application/javascript",
        body: "window.Chart=class{static defaults={color:'',font:{}};constructor(){}destroy(){}}",
      });
    }
    if (url.includes("panzoom")) {
      return route.fulfill({
        contentType: "application/javascript",
        body: "window.panzoom=()=>({dispose(){}})",
      });
    }
    if (url.includes("hls.js")) {
      return route.fulfill({
        contentType: "application/javascript",
        body: "window.Hls=class{static isSupported(){return false}}",
      });
    }
    return route.fulfill({ status: 200, body: "" });
  });

  await page.addInitScript(() => {
    class TestSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.dispatchEvent(new Event("open"));
          this.onopen?.();
          this.emit({ type: "auth_required", ha_version: "test" });
        });
      }
      emit(value) {
        const event = new MessageEvent("message", { data: JSON.stringify(value) });
        this.dispatchEvent(event);
        this.onmessage?.(event);
      }
      send(payload) {
        const message = JSON.parse(payload);
        if (message.type === "auth") this.emit({ type: "auth_ok", ha_version: "test" });
        else this.emit({ id: message.id, type: "result", success: true, result: [] });
      }
      close() {}
    }
    window.WebSocket = TestSocket;
  });

  const state = {
    schema_version: 4,
    sections: {
      rooms: [],
      appliances: [
        {
          id: "appliance-safari",
          name: "Forno",
          device_type: "forno",
          visual_type: "asset",
          visual_key: "forno",
          entities: ["sensor.forno_power"],
        },
      ],
      loads: [],
      entityOverrides: {},
    },
    visibility: {},
  };

  await page.goto(`/legacy/${variant}`);
  await page.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem("dm_dashboard_state", JSON.stringify(seed));
    localStorage.setItem("cd_luci", JSON.stringify({}));
  }, state);
  await page.reload();
  // In Home Assistant this script is injected by the hosted panel. The E2E opens
  // the legacy document directly, so reproduce that production injection here.
  await page.addScriptTag({ url: "/legacy/runtime-hotfix.js" });
  await page.waitForFunction(
    () =>
      window.__DASHBOARDMODERN_LEGACY_READY__ === true &&
      !!window.DashboardModernModules &&
      window.__DASHBOARDMODERN_RUNTIME_HOTFIX__ === true,
  );
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(() => {
    window.cdSyncPush = async () => {};
  });
  expect(pageErrors).toEqual([]);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Safari runtime UI remains usable after rerenders`, async ({ page }, testInfo) => {
    await bootDashboard(page, variant);

    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("luci"));

    const body = page.locator("#ed-body");
    const lightInput = body.locator("[data-light-add-entity]");
    await expect(lightInput).toHaveCount(1);
    const lightId = await lightInput.getAttribute("id");
    expect(lightId).toBeTruthy();
    const picker = body.locator(`.dm-entity-picker[data-entity-target="${lightId}"]`);
    await expect(picker).toHaveCount(1);
    await expect(picker).toBeVisible();

    // Re-render the complete editor body twice. The runtime guard must remount
    // exactly one picker each time, which is what previously failed in Home Assistant.
    await page.evaluate(() => window.editorSwitch("stanze"));
    await page.evaluate(() => window.editorSwitch("luci"));
    await expect(body.locator("[data-light-add-entity]")).toHaveCount(1);
    await expect(body.locator(".dm-entity-picker")).toHaveCount(1);

    await body.evaluate((node) => {
      const spacer = document.createElement("div");
      spacer.dataset.scrollProbe = "";
      spacer.style.height = "1200px";
      node.appendChild(spacer);
    });
    const modal = page.locator("#editor-modal");
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await modal.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    expect(await modal.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect(await body.evaluate((node) => getComputedStyle(node).overflowY)).toBe("visible");
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-runtime-scroll.png` });

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderApplianceSection(true);
    });

    const card = page.locator("#appl-grid-overview .appl-wide-card").first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((node) => getComputedStyle(node).display)).toBe("flex");
    const visual = card.locator(".appl-ic");
    const visualBox = await visual.boundingBox();
    expect(visualBox?.width ?? 0).toBeGreaterThanOrEqual(50);
    expect(visualBox?.height ?? 0).toBeGreaterThanOrEqual(50);
    const graphic = visual.locator("svg, img, ha-icon").first();
    await expect(graphic).toBeVisible();
    const graphicBox = await graphic.boundingBox();
    expect(graphicBox?.width ?? 0).toBeGreaterThanOrEqual(30);
    expect(graphicBox?.height ?? 0).toBeGreaterThanOrEqual(30);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-appliances-real.png` });
  });
}

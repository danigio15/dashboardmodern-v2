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
      appliances: [],
      loads: [],
      lights: [],
      entityOverrides: {},
    },
    visibility: {},
  };

  await page.goto(`/legacy/${variant}`);
  await page.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem("dm_dashboard_state", JSON.stringify(seed));
  }, state);
  await page.reload();

  await page.evaluate(() => {
    localStorage.setItem("cd_luci", JSON.stringify({ "light.salone": "Salone" }));
    localStorage.setItem("cd_luci_rooms", JSON.stringify({ "light.salone": "terrazza" }));
  });

  await page.waitForFunction(
    () =>
      window.__DASHBOARDMODERN_LEGACY_READY__ === true &&
      !!window.DashboardModernModules &&
      window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true &&
      typeof window.editorRenderLuci === "function" &&
      typeof window.cdApplMainCard === "function",
  );
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(() => {
    window.cdSyncPush = async () => {};
    window.__pickedEntityInput = "";
    window.wzPickEntity = (input) => {
      window.__pickedEntityInput = input?.id || "";
    };
  });
  expect(pageErrors).toEqual([]);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: real Safari/HA regressions stay fixed`, async ({ page }, testInfo) => {
    await bootDashboard(page, variant);

    await page.evaluate(async () => {
      await window.DashboardModernModules.store.replaceSection("rooms", [
        { id: "room-terrazza", name: "Terrazza", icon: "🏠", order: 0 },
        { id: "room-salone", name: "Salone", icon: "🛋️", order: 1 },
      ]);
      await window.DashboardModernModules.store.replaceSection("appliances", [
        {
          id: "appliance-safari",
          name: "Forno",
          device_type: "forno",
          image: "/legacy/logo.png",
          room_id: "room-salone",
          power_entity: "sensor.forno_power",
          entities: ["sensor.forno_power"],
          show_in_dashboard: true,
        },
      ]);
    });

    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("luci"));

    const body = page.locator("#ed-body");
    const lightInput = body.locator("[data-light-add-entity]");
    await expect(lightInput).toHaveCount(1);
    const lightId = await lightInput.getAttribute("id");
    expect(lightId).toBeTruthy();

    const lightRoomSelect = body.locator('select[data-light-entity="light.salone"]');
    await expect(lightRoomSelect).toHaveCount(1);
    await expect(lightRoomSelect).toHaveValue("room-salone");
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("cd_luci_rooms"))["light.salone"]),
    ).toBe("room-salone");
    await expect(body).toContainText("Salone");

    let picker = body.locator(`.dm-entity-picker[data-entity-target="${lightId}"]`);
    await expect(picker).toHaveCount(1);
    await expect(picker).toBeVisible();
    await picker.click();
    await expect.poll(() => page.evaluate(() => window.__pickedEntityInput)).toBe(lightId);

    await page.evaluate(() => window.editorSwitch("stanze"));
    await page.evaluate(() => window.editorSwitch("luci"));
    await expect(body.locator("[data-light-add-entity]")).toHaveCount(1);
    picker = body.locator(`.dm-entity-picker[data-entity-target="${lightId}"]`);
    await expect(picker).toHaveCount(1);
    await expect(picker).toBeVisible();
    await page.evaluate(() => {
      window.__pickedEntityInput = "";
    });
    await picker.click();
    await expect.poll(() => page.evaluate(() => window.__pickedEntityInput)).toBe(lightId);

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
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-runtime-scroll.png`,
    });

    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderApplianceSection(true);
    });

    const card = page.locator("#appl-grid-overview .appl-wide-card").first();
    await expect(card).toBeVisible();
    const cardLayout = await card.evaluate((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        display: style.display,
        visibility: style.visibility,
        width: rect.width,
        height: rect.height,
      };
    });
    expect(cardLayout.display).not.toBe("none");
    expect(cardLayout.visibility).not.toBe("hidden");
    expect(cardLayout.width).toBeGreaterThan(0);
    expect(cardLayout.height).toBeGreaterThan(0);

    const roomLabel = card.locator(".dm-ap-room");
    await expect(roomLabel).toContainText("Salone");
    await expect(roomLabel).not.toContainText(/other|altro/i);

    // Showcase card: the custom photo renders in the hero, fully contained,
    // and never falls back to a glyph when the URL is valid.
    const visual = card.locator(".dm-ap-hero");
    const visualBox = await visual.boundingBox();
    expect(visualBox?.width ?? 0).toBeGreaterThanOrEqual(50);
    expect(visualBox?.height ?? 0).toBeGreaterThanOrEqual(50);
    const image = visual.locator("img.dm-ap-img");
    await expect(image).toBeVisible();
    await expect(visual.locator(".dm-appliance-glyph")).toHaveCount(0);
    await expect(visual.locator(".dm-ap-hero-fallback")).toHaveCount(0);
    const imageMetrics = await image.evaluate((node) => {
      const imageStyle = getComputedStyle(node);
      const imageRect = node.getBoundingClientRect();
      const wrapper = node.closest(".dm-ap-hero");
      if (!wrapper) throw new Error("Showcase hero wrapper is missing");
      const wrapperStyle = getComputedStyle(wrapper);
      const wrapperRect = wrapper.getBoundingClientRect();
      return {
        naturalWidth: node.naturalWidth,
        naturalHeight: node.naturalHeight,
        width: imageRect.width,
        height: imageRect.height,
        objectFit: imageStyle.objectFit,
        contained:
          imageRect.left >= wrapperRect.left - 1 &&
          imageRect.top >= wrapperRect.top - 1 &&
          imageRect.right <= wrapperRect.right + 1 &&
          imageRect.bottom <= wrapperRect.bottom + 1,
        overflow: wrapperStyle.overflow,
      };
    });
    expect(imageMetrics.naturalWidth).toBeGreaterThan(0);
    expect(imageMetrics.naturalHeight).toBeGreaterThan(0);
    expect(imageMetrics.width).toBeGreaterThanOrEqual(80);
    expect(imageMetrics.height).toBeGreaterThanOrEqual(80);
    expect(imageMetrics.objectFit).toBe("contain");
    expect(imageMetrics.contained).toBe(true);
    expect(imageMetrics.overflow).toBe("hidden");

    const cardBox = await card.boundingBox();
    if (testInfo.project.name === "desktop")
      expect(cardBox?.width ?? 9999).toBeLessThanOrEqual(540);

    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-appliances-real.png`,
    });
  });
}

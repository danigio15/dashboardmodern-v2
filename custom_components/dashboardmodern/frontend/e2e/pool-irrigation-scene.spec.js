import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-giardino", name: "Giardino", icon: "mdi:flower" }],
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
  visibility: { home: true, piscina: true, irrigazione: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        globalThis.__DM_SERVICE_CALLS__ ||= [];
        if (message.type === "call_service") globalThis.__DM_SERVICE_CALLS__.push(message);
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
}

async function openPool(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_piscina",
      JSON.stringify({
        tempEnt: "sensor.pool_temperature",
        pumpEnt: "switch.pool_pump",
        heatEnt: "switch.pool_heat",
        lightEnt: "switch.pool_light",
        phEnt: "sensor.pool_ph",
        clEnt: "sensor.pool_cl",
        phMin: 7.0,
        phMax: 7.6,
        clMin: 0.5,
        clMax: 1.5,
        filterHours: 8,
        autoHours: true,
      }),
    );
    window.eval(`
      _RAW_STATES['sensor.pool_temperature'] = { state: '27.4', attributes: {} };
      _RAW_STATES['switch.pool_pump'] = { state: 'on', attributes: {} };
      _RAW_STATES['switch.pool_heat'] = { state: 'off', attributes: {} };
      _RAW_STATES['switch.pool_light'] = { state: 'off', attributes: {} };
      _RAW_STATES['sensor.pool_ph'] = { state: '7.2', attributes: {} };
      _RAW_STATES['sensor.pool_cl'] = { state: '1.9', attributes: {} };
    `);
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-piscina")?.classList.add("active");
    renderPiscina();
  });
}

async function openIrrigation(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_irrigazione",
      JSON.stringify({
        zones: [
          { name: "Prato fronte", entity: "switch.irr_prato", mins: 12, room: "Giardino" },
          { name: "Siepe laterale", entity: "switch.irr_siepe", mins: 8, room: "Giardino" },
          { name: "Orto", entity: "valve.irr_orto", mins: 15 },
        ],
        rainEnt: "sensor.rain_probability",
        rainThr: 60,
        time: "06:30",
        enabled: true,
      }),
    );
    window.eval(`
      _RAW_STATES['sensor.rain_probability'] = { state: '18', attributes: {} };
      _RAW_STATES['switch.irr_prato'] = { state: 'off', attributes: {} };
      _RAW_STATES['switch.irr_siepe'] = { state: 'off', attributes: {} };
      _RAW_STATES['valve.irr_orto'] = { state: 'closed', attributes: {} };
    `);
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-irrigazione")?.classList.add("active");
    renderIrrigazione();
  });
}

test("the pool page draws one scene and keeps its controls inside the viewport", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openPool(page);

  const wrap = page.locator("#page-piscina #pool-wrap[data-dm-pool-scene]");
  await expect(wrap).toBeVisible();
  await expect(wrap.locator(".dm-pool-basin")).toBeVisible();
  await expect(wrap.locator(".dm-pool-water")).toBeVisible();
  await expect(wrap.locator(".dm-pool-ladder")).toBeVisible();
  await expect(wrap.locator("[data-dm-pool-temp]")).toHaveText("27.4°");

  // The legacy layers that used to fight over this page are gone.
  await expect(page.locator("#page-piscina .pool-hero")).toHaveCount(0);
  await expect(page.locator("#page-piscina .dm-beta12-pool-basin")).toHaveCount(0);

  await expect(wrap.locator('[data-dm-pool-tile="pump"]')).toHaveAttribute("data-on", "true");
  await expect(wrap.locator('[data-dm-pool-tile="heat"]')).toHaveAttribute("data-on", "false");
  await expect(wrap.locator(".dm-gauge[data-dm-gauge='ph']")).toHaveAttribute("data-verdict", "ok");
  await expect(wrap.locator(".dm-gauge[data-dm-gauge='cl']")).toHaveAttribute(
    "data-verdict",
    "high",
  );

  const geometry = await wrap.evaluate((node) => {
    const stage = node.querySelector("[data-dm-pool-stage]").getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return {
      overflowX: node.scrollWidth - node.clientWidth,
      stageHeight: stage.height,
      stageEscapes: Math.max(box.left - stage.left, stage.right - box.right),
    };
  });
  expect(geometry.overflowX).toBeLessThanOrEqual(1);
  expect(geometry.stageHeight).toBeGreaterThan(180);
  expect(geometry.stageEscapes).toBeLessThanOrEqual(1);
});

test("a pool control still reaches the legacy service handler", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openPool(page);

  await page.locator('[data-dm-pool-tile="light"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (globalThis.__DM_SERVICE_CALLS__ || []).some(
          (call) => call.target?.entity_id === "switch.pool_light",
        ),
      ),
    )
    .toBe(true);
});

test("the irrigation page draws a lawn with one sprinkler per zone", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openIrrigation(page);

  const scene = page.locator("#page-irrigazione [data-dm-irrigation-scene]");
  await expect(scene).toBeVisible();
  await expect(scene.locator("[data-dm-lawn]")).toBeVisible();
  await expect(scene.locator("[data-dm-zone]")).toHaveCount(3);
  await expect(scene).toHaveAttribute("data-dm-irr-running", "false");
  await expect(page.locator("#irr-grid [data-dm-irr-card]")).toHaveCount(3);

  const spots = await scene.evaluate((node) => {
    const lawn = node.querySelector("[data-dm-lawn]").getBoundingClientRect();
    return [...node.querySelectorAll(".dm-sprinkler")].map((sprinkler) => {
      const box = sprinkler.getBoundingClientRect();
      return {
        inside:
          box.left >= lawn.left - 1 &&
          box.right <= lawn.right + 1 &&
          box.top >= lawn.top - 1 &&
          box.bottom <= lawn.bottom + 1,
        x: Math.round(box.left),
      };
    });
  });
  expect(spots).toHaveLength(3);
  expect(spots.every((spot) => spot.inside)).toBe(true);
  expect(new Set(spots.map((spot) => spot.x)).size).toBe(3);
});

test("starting a zone sprays water and splashes it on the lawn", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openIrrigation(page);

  await page.locator('#irr-grid [data-dm-irr-card="0"] [data-act="zstart"]').click();

  const zone = page.locator('#page-irrigazione [data-dm-zone="0"]');
  await expect(zone).toHaveAttribute("data-state", "on");
  await expect(page.locator("#page-irrigazione [data-dm-irrigation-scene]")).toHaveAttribute(
    "data-dm-irr-running",
    "true",
  );
  await expect(page.locator('#irr-grid [data-dm-irr-card="0"]')).toHaveAttribute(
    "data-state",
    "on",
  );

  // The droplets, the landing rings and the wet grass are all animating, and
  // each droplet keeps its own delay so the fan stays spread out.
  const spray = await zone.evaluate((node) => {
    const running = (selector) =>
      [...node.querySelectorAll(selector)].map((element) => {
        const style = getComputedStyle(element);
        return { name: style.animationName, delay: style.animationDelay };
      });
    return {
      drops: running(".dm-zone-spray i"),
      splashes: running(".dm-zone-splashes i"),
    };
  });
  expect(spray.drops).toHaveLength(8);
  expect(spray.drops.every((drop) => /^dmDrop\d$/.test(drop.name))).toBe(true);
  expect(new Set(spray.drops.map((drop) => drop.delay)).size).toBe(8);
  expect(spray.splashes.every((splash) => splash.name === "dmSplash")).toBe(true);

  // The water sheet and the wet grass fade in, so poll them rather than
  // sampling the frame the state attribute flipped on.
  const opacityOf = (selector) =>
    zone.evaluate(
      (node, target) => Number(getComputedStyle(node.querySelector(target)).opacity),
      selector,
    );
  await expect.poll(() => opacityOf(".dm-zone-wet")).toBeGreaterThan(0.5);
  await expect.poll(() => opacityOf(".dm-zone-fan")).toBeGreaterThan(0.2);

  // A second later the legacy countdown has ticked and the scene is still the
  // same DOM: repainting it would have restarted every animation above.
  await zone.evaluate((node) => {
    node.querySelector(".dm-zone-spray i").dataset.dmSprayProbe = "1";
  });
  await page.waitForTimeout(1400);
  const chip = await page
    .locator('#irr-grid [data-dm-irr-card="0"] [data-dm-card-chip]')
    .textContent();
  expect(chip).toMatch(/^💦 \d+:\d{2}$/);
  const survived = await zone.evaluate(
    (node) => node.querySelector('.dm-zone-spray i[data-dm-spray-probe="1"]') !== null,
  );
  expect(survived).toBe(true);
});

test("stopping the programme dries the lawn again", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);
  await openIrrigation(page);

  await page.locator('#irr-grid [data-dm-irr-card="0"] [data-act="zstart"]').click();
  await expect(page.locator('#page-irrigazione [data-dm-zone="0"]')).toHaveAttribute(
    "data-state",
    "on",
  );

  await page.locator('#page-irrigazione [data-dm-irr-program] [data-act="stop"]').click();
  await expect(page.locator('#page-irrigazione [data-dm-zone="0"]')).toHaveAttribute(
    "data-state",
    "off",
  );
  await expect(page.locator("#page-irrigazione [data-dm-irrigation-scene]")).toHaveAttribute(
    "data-dm-irr-running",
    "false",
  );
});

test("an unconfigured pool and lawn explain themselves instead of drawing an empty scene", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, testInfo);

  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-piscina")?.classList.add("active");
    renderPiscina();
    renderIrrigazione();
  });

  await expect(page.locator("#pool-wrap .dm-scene-empty")).toBeVisible();
  await expect(page.locator("#irr-head .dm-scene-empty")).toHaveCount(1);
  await expect(page.locator("#page-piscina [data-dm-pool-stage]")).toHaveCount(0);
});

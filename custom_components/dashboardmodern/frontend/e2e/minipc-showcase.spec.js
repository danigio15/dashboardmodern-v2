// DM-FIX-20260818A
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/** The MiniPC entities mapped, which is what keeps cdAutoHide() from hiding the cards. */
const MAPPED = Object.freeze({
  "dm.server_cpu": "sensor.cpu",
  "dm.server_ram": "sensor.ram",
  "dm.server_disco": "sensor.disk",
  "dm.server_temperatura_cpu": "sensor.temp",
  "dm.server_potenza_raspberry_server": "sensor.power",
  "dm.server_uptime_home_assistant": "sensor.uptime",
  "dm.server_speedtest_download": "sensor.download",
  "dm.server_speedtest_upload": "sensor.upload",
});

function seedWith(entityOverrides) {
  return {
    schema_version: 4,
    sections: {
      rooms: [],
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
      entityOverrides,
    },
    visibility: { home: true },
  };
}

/** Put the MiniPC page on screen with the values the render loop would have written. */
async function openServerPage(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-server")?.classList.add("active");
    const text = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    const bar = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.style.width = `${value}%`;
    };
    text("v-srv-cpu", "23.4");
    bar("srv-fill-cpu", 23.4);
    text("v-srv-ram", "61");
    bar("srv-fill-ram", 61);
    text("v-srv-disk", "88");
    bar("srv-fill-disk", 88);
    text("v-srv-cputemp", "52");
    text("v-srv-temp-status", "🟢 Ottimale");
    const ring = document.getElementById("srv-temp-circle");
    if (ring) {
      const circumference = 2 * Math.PI * 36;
      const drawn = ((52 - 20) / 80) * circumference;
      ring.setAttribute("stroke-dasharray", `${drawn.toFixed(1)} ${circumference.toFixed(1)}`);
    }
    const badge = document.getElementById("waw-net-badge");
    if (badge) badge.className = "srv-status-badge online";
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
}

/** Share of the ring an arc covers, as the page drew it. */
async function arcShare(locator) {
  const [drawn, gap] = ((await locator.getAttribute("stroke-dasharray")) || "")
    .split(" ")
    .map(Number);
  return Math.round((drawn / (drawn + gap)) * 100);
}

test.describe("MiniPC page redesign", () => {
  test("the gauges draw what the legacy bars carry, without losing a hook", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seedWith(MAPPED));
    await openServerPage(page);

    await expect(page.locator("#page-server")).toHaveClass(/dm-srvx/);
    // The bars stay in the DOM: they are what the render loop writes and what
    // the rings read. Losing them would freeze every gauge.
    for (const id of ["srv-fill-cpu", "srv-fill-ram", "srv-fill-disk"])
      await expect(page.locator(`#${id}`)).toHaveCount(1);

    // The value nodes moved into the middle of their ring, and only there.
    await expect(page.locator(".dm-srvx-gauge-val #v-srv-cpu")).toHaveText("23.4");
    await expect(page.locator("#v-srv-ram")).toHaveCount(1);
    await expect(page.locator(".dm-srvx-gauge-val #u-srv-ram")).toHaveCount(1);

    const arcs = page.locator(".dm-srvx-ring-arc");
    expect(await arcShare(arcs.nth(0))).toBe(23);
    expect(await arcShare(arcs.nth(1))).toBe(61);
    expect(await arcShare(arcs.nth(2))).toBe(88);
    // Past the legacy alert threshold the disk gauge turns red on its own.
    await expect(arcs.nth(2)).toHaveAttribute("stroke", "#ef4444");
    await expect(page.locator(".srv-metric").nth(2)).toHaveAttribute("data-dm-srvx-level", "alert");
    await expect(page.locator(".srv-metric").nth(0)).toHaveAttribute("data-dm-srvx-level", "ok");
  });

  test("the thermal card mirrors the status line the runtime owns", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seedWith(MAPPED));
    await openServerPage(page);

    const card = page.locator(".srv-temp-card");
    await expect(card).toHaveAttribute("data-dm-srvx-temp", "ok");
    await expect(page.locator(".dm-srvx-temp-txt")).toHaveText("Ottimale");
    // #srv-temp-circle is still the one arc on the page, drawn by the runtime.
    await expect(page.locator("#srv-temp-circle")).toHaveCount(1);

    await page.evaluate(() => {
      const node = document.getElementById("v-srv-temp-status");
      if (node) node.textContent = "🔴 Alta — Controllare";
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await expect(card).toHaveAttribute("data-dm-srvx-temp", "hot");
    await expect(page.locator(".dm-srvx-temp-txt")).toHaveText("Alta — Controllare");
  });

  test("the page follows the connectivity badge and fills the live trace", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seedWith(MAPPED));
    await openServerPage(page);
    await expect(page.locator("#page-server")).toHaveAttribute("data-dm-srv-net", "on");

    // A few ticks of load, the way the render loop would deliver them.
    await page.evaluate(async () => {
      const bar = document.getElementById("srv-fill-cpu");
      for (const value of [18, 44, 71, 26]) {
        if (bar) bar.style.width = `${value}%`;
        window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    });
    await expect(page.locator(".dm-srvx-trace")).toHaveAttribute("data-dm-srvx-trace", "on");
    await expect(page.locator(".dm-srvx-trace-peak")).toContainText("71%");
    expect((await page.locator(".dm-srvx-trace-line").getAttribute("d"))?.length).toBeGreaterThan(10);

    await page.evaluate(() => {
      const badge = document.getElementById("waw-net-badge");
      if (badge) badge.className = "srv-status-badge offline";
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await expect(page.locator("#page-server")).toHaveAttribute("data-dm-srv-net", "off");
  });

  test("a block the auto-hide empties takes its heading with it", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    // Nothing mapped: cdAutoHide() hides every card that opens a dm.* entity.
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seedWith({}));
    await openServerPage(page);

    await expect(page.locator(".srv-temp-card")).toBeHidden();
    await expect(page.locator('.dm-srvx-head[data-dm-srvx-head=".srv-temp-card"]')).toBeHidden();
    // The rows that open no entity stay, and so does their heading.
    await expect(page.locator('.dm-srvx-head[data-dm-srvx-head=".srv-status-grid"]')).toBeVisible();
    await expect(page.locator(".srv-status-card").first()).toBeVisible();
  });
});

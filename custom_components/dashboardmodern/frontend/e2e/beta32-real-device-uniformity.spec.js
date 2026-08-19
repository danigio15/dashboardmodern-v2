/* The five things the plancia was asked for after beta 31.1:
 *
 *  1. every "choose an entity" row says which field it is for,
 *  2. the Report rows draw the appliance's own icon, and tapping one opens the
 *     appliance picker rather than the quick-action one,
 *  3. an alert's animation acts out that alert,
 *  4. every page opens with the same heading block, and
 *  5. the history popup can be pinched open on a shorter stretch of time.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const APPLIANCES = [
  { id: "a1", name: "Lavatrice", type: "washer", icon: "mdi:washing-machine", energy: "sensor.e1" },
  {
    id: "a2",
    name: "Boiler",
    type: "boiler",
    icon: "mdi:water-boiler",
    energy: "sensor.e1",
    report_icon: "mdi:water-boiler",
  },
];

function seed(extra = {}) {
  return {
    schema_version: 4,
    sections: {
      rooms: [{ id: "r", name: "Salone", icon: "mdi:sofa", temp: "sensor.t" }],
      cameras: [],
      appliances: APPLIANCES,
      loads: [],
      lights: [],
      climate: [],
      ev: [],
      covers: [{ id: "c", name: "Tapparella", entity: "cover.t1" }],
      pool: {},
      irrigation: { zones: [] },
      energy: {},
      entityOverrides: {},
      ...extra,
    },
    visibility: {
      home: true,
      temp: true,
      tapparelle: true,
      piscina: true,
      irrigazione: true,
      ev: true,
      energy: true,
      appliances: true,
      clima: true,
      security: true,
    },
  };
}

const STATES = [
  {
    entity_id: "cover.t1",
    state: "open",
    attributes: { friendly_name: "Tapparella", current_position: 100, supported_features: 15 },
  },
  {
    entity_id: "sensor.t",
    state: "22",
    attributes: { friendly_name: "Temp", unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.e1",
    state: "5",
    attributes: {
      friendly_name: "Lavatrice energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
];

async function boot(page, testInfo, sections) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed(sections));
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-page-masthead-style")),
    null,
    {
      timeout: 15000,
    },
  );
  await page.evaluate((states) => {
    const raw = eval("_RAW_STATES");
    for (const entry of states) raw[entry.entity_id] = entry;
  }, STATES);
}

test("every entity row says which field it fills", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  for (const tab of ["pool", "irr", "tapp", "sez4", "luci"]) {
    const rows = await page.evaluate(async (name) => {
      if (!document.getElementById("editor-modal")?.classList.contains("show"))
        window.apriConfigEntita();
      window.editorSwitch(name);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return [...document.querySelectorAll('#ed-body input[data-entity-input="true"]')].map(
        (input) => {
          const host = input.closest('[data-dm-entity-chip="true"]') || input.parentElement;
          const own = host?.querySelector(".dm-chip-caption")?.textContent?.trim();
          // A slot's own label is sometimes a renameable input rather than text.
          const slotLabel = input
            .closest(".ed-slot,[data-entity-field]")
            ?.querySelector(".ed-slot-lbl,.dm-entity-label");
          const inherited =
            slotLabel?.querySelector("input")?.value?.trim() || slotLabel?.textContent?.trim();
          return own || inherited || "";
        },
      );
    }, tab);
    expect(rows.length, `tab ${tab} has entity rows`).toBeGreaterThan(0);
    expect(
      rows.filter(Boolean).length,
      `tab ${tab} labels every row: ${JSON.stringify(rows)}`,
    ).toBe(rows.length);
  }
});

test("report rows draw the appliance icon and open the appliance picker", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const rows = await page.evaluate(async () => {
    window.apriConfigEntita();
    window.editorSwitch("sez1");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    [...document.querySelectorAll("#ed-body .ed-inner-tabs *,#ed-body button")]
      .find((node) => /report/i.test(node.textContent || ""))
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return [...document.querySelectorAll("#ed-body .dm-report-row")].map((row) => {
      const button = row.querySelector(".dm-report-icon button");
      const painted = Boolean(
        button?.textContent?.trim() || button?.querySelector("svg,img,ha-icon,span"),
      );
      return { painted, token: button?.dataset?.dmReportIconToken || "" };
    });
  });
  expect(rows.length).toBeGreaterThan(0);
  expect(
    rows.every((row) => row.painted),
    JSON.stringify(rows),
  ).toBe(true);

  const picker = await page.evaluate(async () => {
    document.querySelector("#ed-body .dm-report-icon button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const layer = document.getElementById("dm-visual-picker");
    return {
      kind: layer?.dataset?.kind || "",
      title: layer?.querySelector(".dm-picker-title,h3,h4")?.textContent?.trim() || "",
    };
  });
  // "load" is the appliance/consumer catalogue; "action" is the quick-action one.
  expect(picker.kind).toBe("load");
});

test("an alert animates the way its own alert behaves", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["binary_sensor.porta"] = {
      entity_id: "binary_sensor.porta",
      state: "on",
      attributes: { friendly_name: "Porta ingresso", device_class: "door" },
    };
    raw["sensor.batt"] = {
      entity_id: "sensor.batt",
      state: "8",
      attributes: { friendly_name: "Batteria sensore", device_class: "battery" },
    };
    raw["binary_sensor.perdita"] = {
      entity_id: "binary_sensor.perdita",
      state: "on",
      attributes: { friendly_name: "Perdita acqua" },
    };
    raw["binary_sensor.mov"] = {
      entity_id: "binary_sensor.mov",
      state: "on",
      attributes: { friendly_name: "Movimento giardino" },
    };
    localStorage.setItem(
      "cd_avvisi_custom",
      JSON.stringify([
        { name: "Porta ingresso", icon: "🚪", entities: ["binary_sensor.porta"], cond: "on" },
        {
          name: "Batteria scarica",
          icon: "🔋",
          entities: ["sensor.batt"],
          cond: "lt",
          value: "20",
        },
        { name: "Perdita acqua", icon: "💧", entities: ["binary_sensor.perdita"], cond: "on" },
        { name: "Movimento giardino", icon: "🏃", entities: ["binary_sensor.mov"], cond: "on" },
      ]),
    );
    window.cdRenderCustomAvvisi?.();
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "binary_sensor.porta" },
      }),
    );
  });
  /* The alert panel redraws itself whenever its signature changes, and a redraw
   * replaces the icon discs — so reading them once, however long the wait
   * before it, can land between the redraw and the pass that animates them.
   * The whole reading is polled instead: a redraw mid-flight is simply read
   * again, and a build that never settles still fails, at the timeout. */
  const readCards = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#page-home .glance-card")].map((card) => {
        const wrap = card.querySelector(".g-icon-wrap");
        const glyph = wrap?.querySelector(".dm-alert-glyph");
        return {
          name: card.querySelector(".g-name")?.textContent?.trim(),
          motion: wrap?.dataset.dmAlertMotion || "",
          animation: glyph ? getComputedStyle(glyph).animationName : "",
          wrapAnimation: wrap ? getComputedStyle(wrap).animationName : "",
        };
      }),
    );
  const motions = async () => {
    const cards = await readCards();
    const byName = (needle) => cards.find((card) => new RegExp(needle, "i").test(card.name || ""));
    const pick = (needle) => {
      const card = byName(needle);
      return card ? { motion: card.motion, animation: card.animation } : null;
    };
    return {
      door: pick("Porta ingresso"),
      battery: pick("Batteria scarica"),
      leak: pick("Perdita acqua"),
      motion: pick("Movimento giardino"),
    };
  };
  await expect
    .poll(motions, { message: "each alert moves the way its own alert behaves", timeout: 15_000 })
    .toEqual({
      door: { motion: "door", animation: "dmAlertDoor" },
      battery: { motion: "battery", animation: "dmAlertBattery" },
      leak: { motion: "leak", animation: "dmAlertDrip" },
      motion: { motion: "motion", animation: "dmAlertStep" },
    });
  // The disc itself never moves; only the glyph inside it does.
  const cards = await readCards();
  for (const card of cards.filter((entry) => entry.motion)) {
    expect(card.wrapAnimation, `${card.name} disc stays still`).toBe("none");
  }
});

test("every page opens with the same heading, once", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const pages = await page.evaluate(async () => {
    const ids = [
      "page-temp",
      "page-tapparelle",
      "page-piscina",
      "page-irrigazione",
      "page-ev",
      "page-clima",
      "page-energy",
      "page-appliances-main",
      "page-security",
    ];
    const report = [];
    for (const id of ids) {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById(id)?.classList.add("active");
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", { detail: { entity_id: "cover.t1" } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      const host = document.getElementById(id);
      const mast = host?.querySelector(".dm-page-mast");
      const visible = (node) => node && getComputedStyle(node).display !== "none";
      report.push({
        id,
        first: host?.firstElementChild === mast,
        title: mast?.querySelector(".dm-page-mast-title")?.textContent?.trim() || "",
        subtitle: mast?.querySelector(".dm-page-mast-sub")?.textContent?.trim() || "",
        backs: [...(host?.querySelectorAll(".back-home-btn") || [])].filter(visible).length,
      });
    }
    return report;
  });
  for (const entry of pages) {
    expect(entry.first, `${entry.id} opens with the heading`).toBe(true);
    expect(entry.title.length, `${entry.id} names itself`).toBeGreaterThan(2);
    expect(entry.subtitle.length, `${entry.id} says what it is`).toBeGreaterThan(4);
    expect(entry.backs, `${entry.id} shows one way back`).toBe(1);
  }
});

test("the history popup pinches open on a shorter stretch of time", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    // A Chart stub with the surface the zoom code reads: an area, a canvas,
    // labels, and options it can write bounds into.
    window.Chart = class {
      static defaults = { color: "", font: {} };
      static getChart() {
        return null;
      }
      constructor(ctx, config) {
        this.canvas = ctx.canvas;
        this.data = config.data;
        this.options = config.options;
        this.chartArea = { left: 20, right: 340, top: 10, bottom: 200 };
      }
      update() {}
      destroy() {}
    };
    const rows = [];
    const now = Date.now();
    for (let index = 0; index < 120; index += 1) {
      rows.push({
        s: String(40 + Math.round(30 * Math.sin(index / 6))),
        lu: (now - (120 - index) * 60000) / 1000,
      });
    }
    window.DashboardModernEnergyService = {
      broker: { request: async () => ({ "sensor.zz": rows }) },
    };
    eval("_RAW_STATES")["sensor.zz"] = {
      entity_id: "sensor.zz",
      state: "42",
      attributes: { friendly_name: "Prova" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
  });
  const points = await page.evaluate(async () => {
    await window.apriStorico(null, "sensor.zz", "Prova", 24);
    return window.__DASHBOARDMODERN_HISTORY_SECTION__?.chart?.data?.labels?.length || 0;
  });
  expect(points).toBe(120);

  const box = await page.locator("#hist-canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const gesture = (steps) =>
    page.evaluate((moves) => {
      const canvas = document.getElementById("hist-canvas");
      for (const [type, id, x, y] of moves) {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            clientX: x,
            clientY: y,
            buttons: type === "pointerup" ? 0 : 1,
            bubbles: true,
            cancelable: true,
            pointerType: "touch",
          }),
        );
      }
    }, steps);

  await gesture([
    ["pointerdown", 1, cx - 20, cy],
    ["pointerdown", 2, cx + 20, cy],
    ["pointermove", 1, cx - 120, cy],
    ["pointermove", 2, cx + 120, cy],
    ["pointerup", 1, cx - 120, cy],
    ["pointerup", 2, cx + 120, cy],
  ]);
  const zoomed = await page.evaluate(() => ({
    window: window.__DASHBOARDMODERN_HISTORY_SECTION__?.zoom,
    badge: document.querySelector(".dm-hist-zoom [data-dm-hist-range]")?.textContent?.trim() || "",
  }));
  expect(zoomed.window).toBeTruthy();
  expect(zoomed.window.max - zoomed.window.min).toBeLessThan(119);
  expect(zoomed.badge).toMatch(/\d/);

  await gesture([
    ["pointerdown", 3, cx, cy],
    ["pointermove", 3, cx - 90, cy],
    ["pointerup", 3, cx - 90, cy],
  ]);
  const panned = await page.evaluate(() => window.__DASHBOARDMODERN_HISTORY_SECTION__?.zoom);
  expect(panned.min).toBeGreaterThan(zoomed.window.min);
  expect(panned.max - panned.min).toBe(zoomed.window.max - zoomed.window.min);

  await page.locator(".dm-hist-zoom [data-dm-hist-reset]").click();
  expect(await page.evaluate(() => window.__DASHBOARDMODERN_HISTORY_SECTION__?.zoom)).toBeFalsy();
});

// DM-FIX-20260818B
/* The Configuration, tab by tab, answering the same questions the same way.
 *
 * The audit that motivated this counted, on every tab: how many ways there were
 * to save, whether the section switch was there, and how much of *other*
 * sections the tab was carrying. These are those three counts, asserted.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "sensor.temp",
    state: "21",
    attributes: { friendly_name: "Temp", unit_of_measurement: "°C", device_class: "temperature" },
  },
  { entity_id: "light.salone", state: "on", attributes: { friendly_name: "Salone" } },
  { entity_id: "switch.pompa", state: "off", attributes: { friendly_name: "Pompa" } },
  {
    entity_id: "sensor.casa_totale",
    state: "100",
    attributes: {
      friendly_name: "Casa totale",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  { entity_id: "weather.casa", state: "sunny", attributes: { friendly_name: "Meteo casa" } },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", temp: "sensor.temp" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "light-salone", name: "Salone", entities: ["light.salone"] }],
    climate: [],
    ev: [{ id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: {
    home: true,
    energy: true,
    ev: true,
    temp: true,
    tapparelle: true,
    piscina: true,
    irrigazione: true,
    appliances: true,
  },
};

/* Every tab of the configuration, and what it is: a section of the dashboard
 * with a visibility switch, or one of the two that are neither. */
const SECTION_TABS = [
  "sez0",
  "sez1",
  "sez2",
  "sez3",
  "sez4",
  "sez6",
  "sez7",
  "sez9",
  "tapp",
  "pool",
  "irr",
  "appliances",
];
const PLAIN_TABS = ["sez8", "stanze", "luci", "avvisi"];
const NO_SAVE_TABS = ["runtime"];

async function boot(page, testInfo) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((haStates) => {
    const registry = eval("_RAW_STATES");
    for (const entry of haStates) registry[entry.entity_id] = entry;
  }, states);
  await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_CONFIG_UNIFORMITY__));
}

async function openTab(page, tab) {
  await page.evaluate((name) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) {
      window.apriConfigEntita();
    }
    window.editorSwitch(name);
  }, tab);
  // The tab settles over several frames, and how many depends on the machine:
  // panels of their own arrive after the switch, and the runtime narrows the
  // tab to its own section later still. Waiting a fixed number of milliseconds
  // passes on a fast runner and fails on a slow one, so each assertion below
  // polls instead — a build that never settles still fails, at the timeout.
  await page.waitForFunction(
    (name) => document.getElementById("ed-body")?.dataset.dmConfigUniform === name,
    tab,
    { timeout: 10_000 },
  );
}

/* The state of the tab, once it stops changing. */
function settledTabState(page, pick, message) {
  return expect.poll(async () => pick(await tabState(page)), { message, timeout: 10_000 });
}

function tabState(page) {
  return page.evaluate(() => {
    const body = document.getElementById("ed-body");
    const seen = (node) => node.getClientRects().length > 0;
    const saves = [...body.querySelectorAll("button,.ed-btn-add,.ed-save-btn")].filter(
      (node) => /salva|save/i.test(node.textContent || "") && seen(node),
    );
    const banners = [...body.querySelectorAll("[data-key][onclick*='edSecTog']")].filter(seen);
    const footer = body.querySelector(":scope > [data-dm-save-footer]");
    return {
      saveLabels: saves.map((node) => node.textContent.replace(/\s+/g, " ").trim()),
      banners: banners.length,
      bannerIsFirst: banners.length
        ? body.firstElementChild === banners[0] ||
          Boolean(body.firstElementChild?.contains(banners[0]))
        : null,
      footerIsLast: footer ? body.lastElementChild === footer : null,
      accordions: body.querySelectorAll("details.ed-acc").length,
      entityFields: body.querySelectorAll('input[data-entity-input="true"]').length,
    };
  });
}

test.describe("the configuration behaves the same on every tab", () => {
  test("one save, in one place, wherever you are", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of [...SECTION_TABS, ...PLAIN_TABS]) {
      await openTab(page, tab);
      // "＋ Salva attuale" saves the current EV mapping as a new profile: it is
      // an add, not a save of the section, and stays where it is.
      await settledTabState(
        page,
        (view) => view.saveLabels.filter((label) => !label.startsWith("＋")),
        `${tab}: one way to save`,
      ).toEqual(["💾 Salva sezione"]);
      await settledTabState(
        page,
        (view) => view.footerIsLast,
        `${tab}: the save is the last thing on the tab`,
      ).toBe(true);
    }
  });

  test("read-only tabs offer no save at all", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of NO_SAVE_TABS) {
      await openTab(page, tab);
      await settledTabState(page, (view) => view.saveLabels, `${tab}`).toEqual([]);
    }
  });

  test("the section switch is on every section, and always first", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of SECTION_TABS) {
      await openTab(page, tab);
      await settledTabState(page, (view) => view.banners, `${tab}: exactly one switch`).toBe(1);
      await settledTabState(
        page,
        (view) => view.bannerIsFirst,
        `${tab}: the switch opens the tab`,
      ).toBe(true);
    }
    for (const tab of PLAIN_TABS) {
      await openTab(page, tab);
      // These four are not sections of the dashboard, so they have no switch.
      await settledTabState(page, (view) => view.banners, `${tab}: no switch`).toBe(0);
    }
  });

  test("a tab carries its own section and nothing else", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of ["sez0", "sez3", "sez9"]) {
      await openTab(page, tab);
      // It used to be thirteen accordions and 104 entity fields on every one of
      // these tabs, twelve sections of it hidden.
      await settledTabState(
        page,
        (view) => view.accordions,
        `${tab}: one section`,
      ).toBeLessThanOrEqual(2);
      await settledTabState(
        page,
        (view) => view.entityFields,
        `${tab}: only its own fields`,
      ).toBeLessThan(40);
    }
  });

  test("the one save really saves — a section slot", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await openTab(page, "sez0");
    await page.evaluate(() => {
      const input = document.querySelector('#ed-body .ed-slot-in[data-ref="dm.home_meteo"]');
      input.value = "weather.casa";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("#ed-body [data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}")),
      )
      .toMatchObject({ "dm.home_meteo": "weather.casa" });
  });

  test("the one save really saves — a tab that had none", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await openTab(page, "luci");
    await page.evaluate(() => {
      window.__DM_SAVE_ACK__ = 0;
      const previous = window.edSecSave;
      window.edSecSave = function patched(...args) {
        window.__DM_SAVE_ACK__ += 1;
        return previous?.apply(this, args);
      };
    });
    await page.locator("#ed-body [data-dm-save-all]").click();
    // Rows here are written as they are edited; the gesture still answers, with
    // the runtime's own acknowledgement.
    await expect.poll(() => page.evaluate(() => window.__DM_SAVE_ACK__)).toBe(1);
    // The acknowledgement is the runtime's own toast, the same one every other
    // save in the editor raises.
    await expect(page.locator("#ed-toast")).toHaveClass(/show/);
  });
});

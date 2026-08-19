// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const states = [
  {
    entity_id: "sensor.forno_energy",
    state: "4.2",
    attributes: {
      friendly_name: "Forno energy",
      unit_of_measurement: "kWh",
      device_class: "energy",
    },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    appliances: [
      {
        id: "appliance-forno",
        name: "Forno",
        device_type: "forno",
        visual_type: "asset",
        visual_key: "forno",
        entities: ["sensor.forno_energy"],
        energy_entity: "sensor.forno_energy",
        show_in_report: true,
        show_in_dashboard: true,
      },
    ],
    loads: [],
    covers: [],
    lights: [],
  },
  visibility: { energy: true, appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
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
        this.onmessage?.({
          data: JSON.stringify({
            id: message.id,
            type: "result",
            success: true,
            result: message.type === "get_states" ? haStates : null,
          }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((state) => {
      _RAW_STATES[state.entity_id] = structuredClone(state);
      STATES[state.entity_id] = structuredClone(state);
    });

    document.documentElement.dataset.theme = "dark";
    const darkPalette = {
      "--bg-sculpted": "#0c1322",
      "--card-bg": "#161f36",
      "--surface-2": "#1b2540",
      "--surface-3": "#212d4c",
      "--card-border": "#263453",
      "--text": "#e6edf7",
      "--text-dim": "#92a4c2",
    };
    Object.entries(darkPalette).forEach(([name, value]) =>
      document.documentElement.style.setProperty(name, value),
    );
  }, states);

  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);

  await page.evaluate(() => {
    apriConfigEntita();
    editorSwitch("sez1");
  });
  await expect(page.locator("#editor-modal")).toBeVisible();

  const reportTab = page.locator(".ed-inner-tab", { hasText: /^REPORT$/i });
  await reportTab.click();
  await expect(reportTab).toHaveClass(/active/);

  const reportRow = page.locator("#editor-modal .dm-report-row").first();
  await expect(reportRow).toBeVisible();
  await expect(reportRow.locator(".ed-input").first()).toBeVisible();
  await expect(reportRow.locator(".ed-slot-lbl").first()).toBeVisible();
}

function channel(value) {
  value /= 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground, background) {
  const parse = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const luminance = (value) => {
    const [red, green, blue] = parse(value).map(channel);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const variant of PRIMARY) {
  test(`${variant}: dark editor uses the canonical dashboard palette with readable contrast`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    const modal = page.locator("#editor-modal");
    await expect(modal).toHaveAttribute("data-dm-editor-theme", "dark");

    const palette = await page.evaluate(() => {
      const shell = document.querySelector("#editor-modal .ed-shell");
      const tabs = document.querySelector("#editor-modal .ed-tabs");
      const innerTabs = document.querySelector("#editor-modal .ed-inner-tabs");
      const row = document.querySelector("#editor-modal .dm-report-row");
      const input = row?.querySelector(".ed-input");
      const label = row?.querySelector(".ed-slot-lbl");
      if (!shell || !tabs || !innerTabs || !row || !input || !label) return null;

      const style = (node) => getComputedStyle(node);
      return {
        shell: style(shell).backgroundColor,
        tabs: style(tabs).backgroundColor,
        innerTabs: style(innerTabs).backgroundColor,
        row: style(row).backgroundColor,
        input: style(input).backgroundColor,
        inputText: style(input).color,
        labelText: style(label).color,
      };
    });

    expect(palette).not.toBeNull();
    expect(palette).toMatchObject({
      shell: "rgb(22, 31, 54)",
      tabs: "rgb(27, 37, 64)",
      innerTabs: "rgb(27, 37, 64)",
      row: "rgb(27, 37, 64)",
      input: "rgb(33, 45, 76)",
      inputText: "rgb(230, 237, 247)",
      labelText: "rgb(168, 183, 207)",
    });
    expect(contrastRatio(palette.inputText, palette.input)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(palette.labelText, palette.row)).toBeGreaterThanOrEqual(4.5);

    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-editor-dark-readable.png`,
      fullPage: true,
    });
  });
}

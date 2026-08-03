import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "sensor.terrace_temperature",
    state: "35.3",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.terrace_humidity",
    state: "37",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "sensor.oven_power",
    state: "850",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.oven_energy",
    state: "4.2",
    attributes: { unit_of_measurement: "kWh", device_class: "energy" },
  },
  {
    entity_id: "sensor.boiler_energy",
    state: "2.13",
    attributes: { unit_of_measurement: "kWh", device_class: "energy" },
  },
  ...["house_total", "solar_total", "grid_import_total"].map((name) => ({
    entity_id: `sensor.${name}`,
    state: "5000",
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  })),
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      {
        id: "room-terrazza",
        name: "Terrazza",
        icon: "mdi:balcony",
        temp: "sensor.terrace_temperature",
        hum: "sensor.terrace_humidity",
      },
    ],
    appliances: [
      {
        id: "appl-forno",
        name: "Forno",
        device_type: "oven",
        room_id: "room-salone",
        power_entity: "sensor.oven_power",
        energy_entity: "sensor.oven_energy",
        entities: ["sensor.oven_power", "sensor.oven_energy"],
        show_in_dashboard: true,
      },
      {
        id: "appl-boiler",
        name: "Scaldabagno",
        device_type: "water_heater",
        room_id: "room-terrazza",
        energy_entity: "sensor.boiler_energy",
        entities: ["sensor.boiler_energy"],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    energy: {
      house: { total_energy: "sensor.house_total" },
      solar: { total_energy: "sensor.solar_total" },
      grid: { total_import_energy: "sensor.grid_import_total" },
      battery: {},
      metadata: {},
    },
  },
  visibility: { energy: true, appliances: true, temperature: true, temp: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    window.DASHBOARDMODERN_AUTH_TOKEN = "e2e-token";
    window.WebSocket = class extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => this.emit({ type: "auth_required" }));
      }
      emit(message) {
        const event = new MessageEvent("message", { data: JSON.stringify(message) });
        this.dispatchEvent(event);
        this.onmessage?.(event);
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") {
          this.emit({ type: "auth_ok" });
          return;
        }
        if (message.type === "get_states") {
          this.emit({ id: message.id, type: "result", success: true, result: haStates });
          return;
        }
        if (message.type === "subscribe_events") {
          this.emit({ id: message.id, type: "result", success: true, result: null });
          return;
        }
        if (message.type === "recorder/statistics_during_period") {
          const result = Object.fromEntries(
            (message.statistic_ids || []).map((id) => [
              id,
              [{ start: message.start_time, change: 1, sum: 1001, state: 1001 }],
            ]),
          );
          this.emit({ id: message.id, type: "result", success: true, result });
          return;
        }
        this.emit({ id: message.id, type: "result", success: true, result: [] });
      }
      close() {
        this.readyState = 3;
      }
    };
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__?.installed,
  );
  await page.evaluate((haStates) => {
    haStates.forEach((state) => {
      _RAW_STATES[state.entity_id] = structuredClone(state);
      STATES[state.entity_id] = structuredClone(state);
    });
  }, states);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: the selected Energy month changes atomically without a zero flash`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);
    await clickBottomTab(page, "energy", testInfo);

    await page.evaluate(() => {
      const runtime = window.__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__;
      runtime.monthValues = async () => {
        await new Promise((resolve) => setTimeout(resolve, 180));
        return new Map([
          ["sensor.solar_total", 305.4],
          ["sensor.house_total", 511.6],
          ["sensor.grid_import_total", 224],
        ]);
      };

      document.getElementById("ed-kpi-prod").innerHTML = "103.7 <small>kWh</small>";
      document.getElementById("ed-kpi-cons").innerHTML = "566.7 <small>kWh</small>";
      document.getElementById("ed-kpi-auto").innerHTML = "82 <small>%</small>";

      const now = new Date();
      const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = document.getElementById("ed-sel-month");
      const year = document.getElementById("ed-sel-year");
      month.value = String(previous.getMonth() + 1);
      year.value = String(previous.getFullYear());
      month.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(page.locator("[data-dm-period-loading-0157]")).toBeAttached();
    await expect(page.locator("#view-panoramica")).toHaveAttribute("aria-busy", "true");

    await page.evaluate(() => {
      document.getElementById("ed-kpi-prod").innerHTML = "0 <small>kWh</small>";
      document.getElementById("ed-kpi-cons").innerHTML = "0 <small>kWh</small>";
      document.getElementById("ed-kpi-auto").innerHTML = "0 <small>%</small>";
    });

    await expect(page.locator("#ed-kpi-prod")).toContainText(/103[,.]7/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/566[,.]7/);
    await expect(page.locator("#ed-kpi-auto")).toContainText("82");

    await expect(page.locator("#ed-kpi-prod")).toContainText(/305[,.]4/);
    await expect(page.locator("#ed-kpi-cons")).toContainText(/511[,.]6/);
    await expect(page.locator("#ed-kpi-auto")).toContainText("56");
  });

  test(`${variant}: appliance rooms, configured images and temperature cards remain stable`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    const uiResult = await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      const pageNode = document.getElementById("page-appliances-main");
      pageNode.classList.add("active");
      pageNode.innerHTML = `
        <div><button type="button">← HOME</button></div>
        <div class="legacy-room-nav"><button type="button">📊 PANORAMICA</button><button type="button">❔ NESSUNA STANZA</button></div>
        <article class="appl-wide-card" data-appliance-id="appl-forno">
          <div class="appl-ic"><img src="/local/oven-art.png" alt="Forno"></div>
          <div class="appl-wide-info"><div class="appl-wide-name">Forno</div><div class="appl-wide-cat">—</div><div class="appl-live"><span class="appl-mini">∑ Totale 4.2 kWh</span></div></div>
        </article>
        <article class="appl-wide-card" data-appliance-id="appl-boiler">
          <div class="appl-ic"><img src="/local/boiler-art.png" alt="Scaldabagno"></div>
          <div class="appl-wide-info"><div class="appl-wide-name">Scaldabagno</div><div class="appl-wide-cat">—</div><div class="appl-live"><span class="appl-mini">∑ Totale 2.13 kWh</span></div></div>
        </article>`;
      const ui = window.__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__;
      ui.decorateAppliances();
      const cards = [...pageNode.querySelectorAll(".appl-wide-card")];
      const initial = {
        metric: pageNode.querySelector(".dm-appliance-metrics-0157")?.textContent || "",
        image: cards[0]?.querySelector(".appl-ic img")?.getAttribute("src") || "",
        rooms: cards.map((card) => card.querySelector(".appl-wide-cat")?.textContent || ""),
        navCount: pageNode.querySelectorAll(".dm-appliance-room-nav-0157").length,
      };
      pageNode.querySelector('[data-dm-appliance-room-0157="room-salone"]')?.click();
      const salone = cards.map((card) => card.hidden);
      pageNode.querySelector('[data-dm-appliance-room-0157=""]')?.click();
      const overview = cards.map((card) => card.hidden);

      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-temp").classList.add("active");
      const grid = document.getElementById("temp-grid");
      grid.innerHTML = `<article class="temp-card" data-room-id="room-terrazza"><div class="cp-name">Terrazza</div><div id="tv_room-terrazza">35.3</div><div id="hv_room-terrazza">37</div><div id="tc_room-terrazza">🔥</div></article>`;
      ui.decorateTemperatures();
      const temperature = grid.querySelector(".dm-temperature-card-0157")?.textContent || "";
      return { initial, salone, overview, temperature };
    });

    expect(uiResult.initial.metric).toMatch(/Consumo totale|Total energy/);
    expect(uiResult.initial.image).toBe("/local/oven-art.png");
    expect(uiResult.initial.rooms[0]).toContain("Salone");
    expect(uiResult.initial.rooms[1]).toContain("Terrazza");
    expect(uiResult.initial.navCount).toBe(1);
    expect(uiResult.salone).toEqual([false, true]);
    expect(uiResult.overview).toEqual([false, false]);
    expect(uiResult.temperature).toMatch(/Molto caldo|Very hot/);
    expect(uiResult.temperature).toMatch(/35[,.]3/);
    expect(uiResult.temperature).toContain("37");
    expect(uiResult.temperature).not.toContain("🔥");
  });
}

/* The 🪄 button in Config, driven end to end: it must read the instance, show
 * what it found before writing anything, and write exactly the keys the runtime
 * has always written once the proposal is accepted. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STATES = [
  {
    entity_id: "sensor.cucina_temperatura",
    state: "21.5",
    attributes: {
      friendly_name: "Temperatura cucina",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.cucina_umidita",
    state: "48",
    attributes: {
      friendly_name: "Umidità cucina",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  {
    entity_id: "sensor.salotto_temperatura",
    state: "22.4",
    attributes: {
      friendly_name: "Temperatura salotto",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.solaredge_produzione_oggi",
    state: "12.4",
    attributes: {
      friendly_name: "Produzione solare oggi",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.solaredge_produzione_mese",
    state: "240",
    attributes: {
      friendly_name: "Produzione solare mese",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.fotovoltaico_potenza",
    state: "1830",
    attributes: {
      friendly_name: "Potenza fotovoltaico",
      unit_of_measurement: "W",
      device_class: "power",
    },
  },
  {
    entity_id: "sensor.batteria_soc",
    state: "76",
    attributes: {
      friendly_name: "Stato carica batteria",
      unit_of_measurement: "%",
      device_class: "battery",
    },
  },
  { entity_id: "light.cucina", state: "on", attributes: { friendly_name: "Luce cucina" } },
  { entity_id: "light.salotto", state: "off", attributes: { friendly_name: "Luce salotto" } },
  { entity_id: "climate.salotto", state: "cool", attributes: { friendly_name: "Clima salotto" } },
  { entity_id: "camera.ingresso", state: "idle", attributes: { friendly_name: "Camera ingresso" } },
  { entity_id: "weather.casa", state: "sunny", attributes: { friendly_name: "Meteo casa" } },
];

// Two of the temperature sensors live in a Home Assistant area. The rooms the
// detector proposes must come from those areas, not from their names.
const AREAS = [
  { area_id: "area_cucina", name: "Cucina", floor_id: "piano_terra" },
  { area_id: "area_salotto", name: "Salotto", floor_id: "piano_terra" },
];
const DEVICES = [{ id: "dev_multisensore", area_id: "area_cucina" }];
const ENTITIES = [
  { entity_id: "sensor.cucina_temperatura", device_id: "dev_multisensore", area_id: null },
  { entity_id: "sensor.cucina_umidita", device_id: "dev_multisensore", area_id: null },
  { entity_id: "sensor.salotto_temperatura", device_id: null, area_id: "area_salotto" },
  { entity_id: "light.cucina", device_id: null, area_id: "area_cucina" },
];

const seed = { schema_version: 4, sections: { rooms: [] }, visibility: {} };

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: the Config auto-detection shows what it found before writing it`, async ({
    page,
  }, testInfo) => {
    // The flow waits on two Home Assistant reads and ends in a real reload, so
    // it is slower than a render test by design.
    test.slow();
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript(
      ({ states, areas, devices, entities }) => {
        window.WebSocket = class extends EventTarget {
          static OPEN = 1;
          readyState = 1;
          constructor() {
            super();
            queueMicrotask(() =>
              this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }),
            );
          }
          send(raw) {
            const message = JSON.parse(raw);
            if (message.type === "auth") {
              this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
              return;
            }
            const byType = {
              get_states: states,
              "config/area_registry/list": areas,
              "config/device_registry/list": devices,
              "config/entity_registry/list": entities,
            };
            this.onmessage?.({
              data: JSON.stringify({
                id: message.id,
                type: "result",
                success: true,
                result: byType[message.type] || [],
              }),
            });
          }
          close() {}
        };
      },
      { states: STATES, areas: AREAS, devices: DEVICES, entities: ENTITIES },
    );
    await bootNamespacedDashboard(page, variant, testInfo, seed);
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await page.evaluate((haStates) => {
      haStates.forEach((state) => {
        _RAW_STATES[state.entity_id] = state;
        STATES[state.entity_id] = state;
      });
      apriConfigEntita();
      editorSwitch("visib");
    }, STATES);

    // The flow ends in a real reload, so the marker below is how the test knows
    // the page it is reading is the one that came back.
    await page.evaluate(() => {
      window.__dmBeforeReload = true;
    });

    /* The override replaces the runtime's own `edAutoRileva`, so a click landing
     * before the modules finish loading legitimately gets the vendored flow.
     * Waiting for the owner to exist keeps this test about the new behaviour
     * rather than about how fast the machine served the modules. */
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_ENTITY_AUTODETECT__?.installed === true,
    );
    const button = page
      .locator("#ed-body button", { hasText: /autorilevamento|auto-?detect/i })
      .first();
    await expect(button).toBeVisible();
    await button.click();

    const summary = page.locator("#ed-rileva-out .dm-ad-summary");
    // The flow's own ceiling is the two Home Assistant reads; the rest of this
    // budget is for a machine running several dashboards at once.
    await expect(summary).toBeVisible({ timeout: 30_000 });
    // Nothing is written until the proposal is accepted.
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze") || "[]")),
    ).toEqual([]);

    const rows = await summary
      .locator(".dm-ad-row")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
    expect(rows.join(" | ")).toMatch(/2/); // two rooms, two lights, one camera…
    await expect(summary.locator(".dm-ad-link").first()).toContainText("sensor.");

    await summary.locator(".dm-ad-apply").click();
    await page.waitForFunction(
      () => window.__dmBeforeReload === undefined && window.__DASHBOARDMODERN_LEGACY_READY__,
      undefined,
      { timeout: 30_000 },
    );

    const written = await page.evaluate(() => ({
      rooms: DashboardModernModules.store.getSection("rooms"),
      lights: JSON.parse(localStorage.getItem("cd_luci") || "{}"),
      cameras: JSON.parse(localStorage.getItem("cd_cameras") || "[]"),
      climate: JSON.parse(localStorage.getItem("cd_clima_units") || "[]"),
      overrides: JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}"),
      energy: DashboardModernModules.store.getSection("energy"),
    }));

    // Rooms carry the Home Assistant area names, with the humidity twin of the
    // area attached — the registry path the runtime could never reach in time.
    const detected = written.rooms.filter((room) => room.temp);
    expect(detected.map((room) => room.name).sort()).toEqual(["Cucina", "Salotto"]);
    const kitchen = detected.find((room) => room.name === "Cucina");
    expect(kitchen.temp).toBe("sensor.cucina_temperatura");
    expect(kitchen.hum).toBe("sensor.cucina_umidita");
    expect(Object.keys(written.lights).sort()).toEqual(["light.cucina", "light.salotto"]);
    expect(written.cameras[0].entity).toBe("camera.ingresso");
    expect(written.climate[0].entity).toBe("climate.salotto");

    // Energy links land in the canonical Energy model, which is what owns those
    // slots in schema 4 — writing them as plain overrides would be undone by the
    // store's own projection on the next save.
    expect(written.energy.solar.daily_energy).toBe("sensor.solaredge_produzione_oggi");
    expect(written.energy.solar.monthly_energy).toBe("sensor.solaredge_produzione_mese");
    expect(written.energy.battery.soc).toBe("sensor.batteria_soc");
    // And they come back out as the legacy slots the runtime reads.
    expect(written.overrides["dm.energy_produzione_solare_oggi"]).toBe(
      "sensor.solaredge_produzione_oggi",
    );
    // Everything outside Energy stays an override, as it always was.
    expect(written.overrides["dm.home_meteo"]).toBe("weather.casa");
  });
}

/* La stazione meteo personale nel widget della Home (#205).
 *
 * L'utente con la Ecowitt mappa i suoi sensori negli slot dm.home_meteo_*:
 * il widget deve mostrare QUEI numeri — non gli attributi dell'entita'
 * weather — la percepita compare come riga sua, e la direzione in gradi
 * diventa la rosa dei venti. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
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
        const result =
          message.type === "get_states"
            ? []
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

test("i sensori della stazione vincono sull'entita' weather, direzione compresa", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    const metti = (id, state, unit) => {
      _RAW_STATES[id] = {
        entity_id: id,
        state,
        attributes: unit ? { unit_of_measurement: unit } : {},
      };
    };
    metti("weather.casa", "sunny");
    _RAW_STATES["weather.casa"].attributes = { temperature: 99, humidity: 12, wind_speed: 55 };
    metti("sensor.gw1100a_outdoor_temperature", "23.44", "°C");
    metti("sensor.gw1100a_humidity", "61", "%");
    metti("sensor.gw1100a_feels_like_temperature", "25.1", "°C");
    metti("sensor.gw1100a_wind_speed", "12.7", "km/h");
    metti("sensor.gw1100a_wind_direction", "22.5", "°");
    window.cdApplyCanonicalOverrides({
      "dm.home_meteo": "weather.casa",
      "dm.home_meteo_temperatura": "sensor.gw1100a_outdoor_temperature",
      "dm.home_meteo_umidita": "sensor.gw1100a_humidity",
      "dm.home_meteo_percepita": "sensor.gw1100a_feels_like_temperature",
      "dm.home_meteo_vento": "sensor.gw1100a_wind_speed",
      "dm.home_meteo_vento_direzione": "sensor.gw1100a_wind_direction",
    });
    window.render?.();
  });
  await expect(page.locator("#w-temp")).toHaveText("23.4°C");
  await expect(page.locator("#w-hum")).toHaveText("61%");
  await expect(page.locator("#w-wind")).toHaveText("12.7 km/h · NNE");
  await expect(page.locator("#w-feel-row")).toBeVisible();
  await expect(page.locator("#w-feel")).toHaveText("25.1°C");
  // L'entita' weather resta padrona di stato e icona.
  await expect(page.locator("#w-state")).toHaveText(/Soleggiato/i);
});

test("senza stazione il widget resta quello dell'entita' weather", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    _RAW_STATES["weather.casa"] = {
      entity_id: "weather.casa",
      state: "cloudy",
      attributes: { temperature: 21, humidity: 47, wind_speed: 9 },
    };
    window.cdApplyCanonicalOverrides({ "dm.home_meteo": "weather.casa" });
    window.render?.();
  });
  await expect(page.locator("#w-temp")).toHaveText("21°C");
  await expect(page.locator("#w-hum")).toHaveText("47%");
  await expect(page.locator("#w-wind")).toHaveText("9 km/h");
  await expect(page.locator("#w-feel-row")).toBeHidden();
});

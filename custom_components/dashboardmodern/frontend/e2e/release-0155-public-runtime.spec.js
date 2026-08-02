import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const liveStates = [
  {
    entity_id: "sensor.terrace_temperature",
    state: "22.4",
    attributes: {
      friendly_name: "Terrace temperature",
      unit_of_measurement: "°C",
      device_class: "temperature",
    },
  },
  {
    entity_id: "sensor.terrace_humidity",
    state: "51",
    attributes: {
      friendly_name: "Terrace humidity",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
  {
    entity_id: "switch.fridge",
    state: "on",
    attributes: { friendly_name: "Fridge" },
  },
  {
    entity_id: "sensor.fridge_power",
    state: "82",
    attributes: {
      friendly_name: "Fridge power",
      unit_of_measurement: "W",
      device_class: "power",
    },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-terrace",
        name: "Terrazza",
        icon: "mdi:balcony",
        floor: "Esterno",
        temp: "sensor.terrace_temperature",
        hum: "sensor.terrace_humidity",
      },
    ],
    appliances: [
      {
        id: "appl-fridge",
        name: "Frigo",
        device_type: "fridge",
        visual_type: "asset",
        visual_key: "fridge",
        room_id: "room-terrace",
        control_entity: "switch.fridge",
        power_entity: "sensor.fridge_power",
        threshold_run: 5,
        threshold_standby: 1,
        show_in_dashboard: true,
        show_in_report: true,
      },
    ],
  },
  visibility: { temperature: true, temp: true, appliances: true, energy: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate((states) => {
    window.__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__?.ingestStates(states);
  }, liveStates);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__?.states?.size || 0,
      ),
    )
    .toBeGreaterThanOrEqual(liveStates.length);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: 0.14.15 keeps HA energy truth and live room/device states`, async ({
    page,
  }, testInfo) => {
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      buildTempCards();
      renderTemperature();
      window.__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__.syncTemperature();
      renderApplianceSection(true);
      window.__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__.syncAppliances();
    });

    const temperature = page.locator("#temp-grid .temp-value").first();
    await expect(temperature).toContainText("22.4");
    const humidity = page.locator('#temp-grid [id^="hv_sensor_terrace_humidity"]').first();
    await expect(humidity).toContainText("51");

    const card = page.locator('.appl-wide-card[data-appliance-id="appl-fridge"]').first();
    await expect(card).toHaveClass(/on/);
    await expect(card.locator(".appl-st")).toContainText(
      variant === "dashboard-en.html" ? /RUNNING|ON/i : /IN FUNZIONE|ACCESO/i,
    );
    await expect(card.locator('button[data-dm-power-toggle="true"]')).toContainText(
      variant === "dashboard-en.html" ? "Turn off" : "Spegni",
    );

    await page.evaluate(() => {
      const canonical = {
        "v-solar-month": "42.7 kWh",
        "v-home-month": "32.9 kWh",
        "v-grid-month": "↓ 0 kWh ↑ 6.9 kWh",
        "v-battery-month": "↓ 8.2 kWh ↑ 5.3 kWh",
      };
      Object.entries(canonical).forEach(([id, value]) => {
        document.getElementById(id).textContent = value;
      });
      try {
        window.eval(`
          CD_PERIOD["dm.energy_produzione_solare_mese"] = 42.7;
          CD_PERIOD["dm.energy_consumo_casa_mese"] = 27.6;
          CD_PERIOD["dm.energy_rete_acquistata_mese"] = 0;
          CD_PERIOD["dm.energy_rete_venduta_mese"] = 7;
          CD_PERIOD["dm.energy_batteria_caricata_mese"] = 8.4;
          CD_PERIOD["dm.energy_batteria_usata_mese"] = 5.4;
        `);
      } catch (_error) {}
      window.dispatchEvent(new CustomEvent("dashboardmodern:energy-periods-0154"));
    });

    await page.waitForTimeout(300);
    await expect(page.locator("#v-solar-month")).toHaveText("42.7 kWh");
    await expect(page.locator("#v-home-month")).toHaveText("32.9 kWh");
    await expect(page.locator("#v-grid-month")).toContainText("6.9 kWh");
    await expect(page.locator("#v-battery-month")).toContainText("8.2 kWh");
    await expect(page.locator("#v-battery-month")).toContainText("5.3 kWh");
  });
}

import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { fillEntityFieldByHand } from "./helpers/entity-field.js";
import { PRIMARY } from "./helpers/variants.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "mdi:sofa",
        floor: "Piano terra",
        temp: "",
        hum: "",
        metadata: {},
      },
      {
        id: "room-bagno",
        name: "Bagno",
        icon: "🚿",
        floor: "Piano terra",
        temp: "",
        hum: "",
        metadata: {},
      },
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "🛏️",
        floor: "Primo piano",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
        metadata: {},
      },
    ],
    cameras: [],
    appliances: [
      {
        id: "appliance-dishwasher",
        name: "Lavastoviglie",
        visual_type: "asset",
        visual_key: "lavastoviglie",
        device_type: "lavastoviglie",
        icon: "lavastoviglie",
        image: "/local/stale-washer.png",
        image_url: "/local/stale-washer.png",
        power_entity: "sensor.dishwasher_power",
        entities: ["sensor.dishwasher_power"],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true, temperature: true },
};

async function boot(page, variant, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
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
        if (message.type === "frontend/set_user_data") result = null;
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}



/* I due campi della riga "aggiungi stanza" erano due quadratini.
 *
 * La riga nasce dal runtime come una fila flex; la rifinitura la trasforma in
 * una griglia, e in una griglia il flex dei campi non vale piu' niente: un
 * campo di testo vuoto tiene la sua larghezza naturale, cioe' zero, e restano
 * due riquadri larghi quanto la loro cornice con il resto della riga vuoto. */
for (const variant of PRIMARY) {
  test(`${variant}: the add-room fields fill the row`, async ({ page }, testInfo) => {
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
      editorSwitch("stanze");
    });

    const row = page.locator("#ed-body .dm-beta5-room-add-row");
    await expect(row).toBeVisible();

    const boxes = await row.evaluate((node) => {
      const width = (el) => Math.round(el.getBoundingClientRect().width);
      return {
        row: width(node),
        trigger: width(node.querySelector(".dm-beta5-room-icon-trigger")),
        icon: width(node.querySelector("#ed-room-icon")),
        name: width(node.querySelector("#ed-room-name")),
      };
    });

    // The icon field is the fixed middle column, the name takes what is left.
    expect(boxes.icon).toBeGreaterThan(100);
    expect(boxes.name).toBeGreaterThan(boxes.row / 2);
    // Nothing of the row is left unclaimed.
    expect(boxes.trigger + boxes.icon + boxes.name).toBeGreaterThan(boxes.row - 40);
  });
}

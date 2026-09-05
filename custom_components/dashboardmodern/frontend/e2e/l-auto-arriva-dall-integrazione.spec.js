/* L'auto entra dal menu delle integrazioni, gia' fatta.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» E' il giro degli elettrodomestici e dei robot: si sceglie
 * l'integrazione, si sceglie il dispositivo, e la vettura nasce con le caselle
 * gia' piene invece di battere venti entity_id a mano.
 *
 * Le entita' sono quelle vere di un'auto a benzina con la telemetria del
 * costruttore: livello carburante, autonomia, contachilometri, batteria di
 * servizio, portiere, bagagliaio, cofano, posizione.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  device_id: "auto-1",
  platform: "kia_uvo",
  name,
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  ...extra,
});

const CATALOGO = {
  integrations: [
    {
      domain: "kia_uvo",
      name: "Kia/Hyundai Connect",
      custom: true,
      devices: 1,
      entries: [{ entry_id: "uvo-1", title: "Connect", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "auto-1",
      name: "TUCSON",
      manufacturer: "Hyundai",
      model: "Tucson",
      integration: "kia_uvo",
      integrations: ["kia_uvo"],
      area_id: "",
      area: "",
      entities: 11,
      disabled: false,
    },
  ],
  entities: [
    ent("sensor.tucson_fuel_level", "Fuel level", { unit: "%" }),
    ent("sensor.tucson_range", "Range", { device_class: "distance", unit: "km" }),
    ent("sensor.tucson_odometer", "Odometer", { unit: "km" }),
    ent("sensor.tucson_battery_12v", "12V battery level", { unit: "%" }),
    ent("binary_sensor.tucson_doors", "Doors", { device_class: "door" }),
    ent("binary_sensor.tucson_trunk", "Trunk", { device_class: "opening" }),
    ent("binary_sensor.tucson_hood", "Hood", { device_class: "opening" }),
    ent("device_tracker.tucson", "Location"),
    ent("sensor.tucson_engine", "Engine"),
    /* Le impostazioni del dispositivo non sono l'auto: restano fuori. */
    ent("number.tucson_volume", "Volume", { category: "config" }),
  ],
};

const STATI = CATALOGO.entities.map((voce) => ({
  entity_id: voce.entity_id,
  state: voce.entity_id.startsWith("binary_sensor.") ? "off" : "42",
  attributes: {
    friendly_name: `TUCSON ${voce.name}`,
    ...(voce.device_class ? { device_class: voce.device_class } : {}),
    ...(voce.unit ? { unit_of_measurement: voce.unit } : {}),
  },
}));

const SEME = {
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
    entityOverrides: {},
  },
  visibility: { ev: true },
};

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, catalogo }) => {
      class PonteFinto extends EventTarget {
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
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = null;
          if (messaggio.type === "get_states") risultato = haStates;
          else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
          else if (messaggio.type === "dashboardmodern/integrations/catalog") {
            const volute = Array.isArray(messaggio.device_ids) ? messaggio.device_ids : [];
            risultato = {
              integrations: catalogo.integrations,
              devices: catalogo.devices,
              entities: catalogo.entities.filter((voce) => volute.includes(voce.device_id)),
            };
          } else if (messaggio.type === "call_service") risultato = {};
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({
                id: messaggio.id,
                type: "result",
                success: true,
                result: risultato,
              }),
            }),
          );
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { haStates: STATI, catalogo: CATALOGO },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    haStates.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
  }, STATI);
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez2");
  });
  await expect(page.locator('#ed-body input[placeholder*="Nome auto"]')).toBeVisible();
}

test("dal menu delle integrazioni nasce l'auto gia' compilata", async ({ page }, testInfo) => {
  await boot(page, testInfo);

  /* L'invito sta in cima alla scheda, sopra le caselle. */
  const invito = page.locator("#ed-body [data-auto-integ]");
  await expect(invito).toBeVisible();
  await invito.click();

  const menu = page.locator("#dm-integ-menu");
  await expect(menu).toBeVisible();
  await menu.locator('.dm-integ-item[data-domain="kia_uvo"]').click();
  await menu.locator('.dm-integ-device[data-device-id="auto-1"]').click();

  /* L'anteprima dice cosa ha capito, prima di confermare: che auto e', e
   * quali caselle si riempiono. */
  const anteprima = menu.locator("[data-preview]");
  await expect(anteprima).toContainText("sensor.tucson_fuel_level");
  await expect(anteprima).toContainText("sensor.tucson_range");
  await expect(anteprima).toContainText("sensor.tucson_odometer");
  /* Un serbatoio senza batteria di trazione e' un'auto a benzina. */
  await expect(anteprima).toContainText("Auto a benzina");
  /* Le impostazioni del dispositivo restano fuori. */
  await expect(anteprima).not.toContainText("number.tucson_volume");

  await anteprima.locator("[data-confirm]").click();
  await expect(menu).toHaveCount(0);

  /* L'auto c'e', col motore che le entita' hanno lasciato capire e le caselle
   * al loro posto. */
  const salvata = await page.evaluate(() => {
    const lista = JSON.parse(localStorage.getItem("cd_ev_cars") || "[]");
    return lista[lista.length - 1] || null;
  });
  expect(salvata).toBeTruthy();
  expect(salvata.name).toBe("TUCSON");
  expect(salvata.tipo).toBe("termica");
  const caselle = salvata.ov || salvata.overrides || {};
  expect(caselle["dm.ev_carburante"]).toBe("sensor.tucson_fuel_level");
  expect(caselle["dm.ev_autonomia"]).toBe("sensor.tucson_range");
  expect(caselle["dm.ev_odometro"]).toBe("sensor.tucson_odometer");
  expect(caselle["dm.ev_batteria_servizio"]).toBe("sensor.tucson_battery_12v");
  expect(caselle["dm.ev_portiere"]).toBe("binary_sensor.tucson_doors");
  expect(caselle["dm.ev_bagagliaio"]).toBe("binary_sensor.tucson_trunk");
  expect(caselle["dm.ev_cofano"]).toBe("binary_sensor.tucson_hood");
  expect(caselle["dm.ev_posizione"]).toBe("device_tracker.tucson");
  /* Il volume e' un'impostazione del dispositivo e non entra da nessuna parte. */
  expect(Object.values(caselle)).not.toContain("number.tucson_volume");
});

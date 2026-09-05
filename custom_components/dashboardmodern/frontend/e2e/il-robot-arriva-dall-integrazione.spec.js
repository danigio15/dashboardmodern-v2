/* Il robot entra dal menu delle integrazioni, intero.
 *
 * «Questa cosa sviluppata su elettrodomestici, di gestire le integrazioni
 * presenti, la devi implementare anche per la sezione robot.» E' lo stesso
 * giro: si sceglie l'integrazione, si sceglie il dispositivo, e il robot nasce
 * con le sue caselle gia' piene — l'entita' che lo comanda, la mappa, la
 * batteria e i suoi programmi.
 *
 * La finestra e' letteralmente la stessa degli elettrodomestici: cambia solo
 * cosa si legge del dispositivo, che e' l'unico pezzo diverso fra le due
 * sezioni. Qui si guarda il risultato — la riga che compare nella scheda
 * Robot, con dentro quello che il dispositivo ha lasciato capire.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  device_id: "rb-1",
  platform: "roborock",
  name,
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  hidden: false,
  ...extra,
});

const CATALOGO = {
  integrations: [
    {
      domain: "roborock",
      name: "Roborock",
      custom: false,
      devices: 2,
      entries: [{ entry_id: "rr-1", title: "Roborock", state: "loaded" }],
    },
    { domain: "shelly", name: "Shelly", custom: false, devices: 1, entries: [] },
  ],
  devices: [
    {
      id: "rb-1",
      name: "Roborock Qrevo Edge",
      manufacturer: "Roborock",
      model: "Qrevo Edge",
      integration: "roborock",
      integrations: ["roborock"],
      area_id: "a1",
      area: "Salone",
      entities: 8,
      disabled: false,
    },
    {
      id: "mw-1",
      name: "Automower 305",
      manufacturer: "Husqvarna",
      model: "305",
      integration: "roborock",
      integrations: ["roborock"],
      area_id: "",
      area: "",
      entities: 2,
      disabled: false,
    },
    {
      id: "plug-1",
      name: "Presa",
      manufacturer: "Shelly",
      model: "Plus Plug S",
      integration: "shelly",
      integrations: ["shelly"],
      area_id: "",
      area: "",
      entities: 1,
      disabled: false,
    },
  ],
  entities: [
    ent("vacuum.roborock_qrevo_edge", "Roborock Qrevo Edge"),
    ent("camera.roborock_qrevo_edge_mappa", "Mappa"),
    ent("sensor.roborock_qrevo_edge_batteria", "Batteria", { device_class: "battery", unit: "%" }),
    ent("button.roborock_qrevo_edge_pulizia_completa", "Pulizia completa"),
    ent("button.roborock_qrevo_edge_solo_lavaggio", "Solo lavaggio"),
    ent("select.roborock_qrevo_edge_mocio", "Modalità mocio"),
    ent("switch.roborock_qrevo_edge_blocco_bambini", "Blocco bambini"),
    /* Le impostazioni del dispositivo: non sono programmi e non devono
     * finire sulla scheda. */
    ent("number.roborock_qrevo_edge_volume", "Volume", { category: "config" }),
    ent("sensor.roborock_qrevo_edge_wifi", "Segnale wifi", { category: "diagnostic" }),
    ent("lawn_mower.automower_305", "Automower 305", { device_id: "mw-1", platform: "husqvarna" }),
    ent("sensor.automower_305_carica", "Carica", {
      device_id: "mw-1",
      platform: "husqvarna",
      device_class: "battery",
    }),
  ],
};

const STATI = [
  {
    entity_id: "vacuum.roborock_qrevo_edge",
    state: "docked",
    attributes: { friendly_name: "Roborock Qrevo Edge", battery_level: 100 },
  },
  {
    entity_id: "sensor.roborock_qrevo_edge_batteria",
    state: "100",
    attributes: { friendly_name: "Roborock Qrevo Edge Batteria", device_class: "battery" },
  },
  {
    entity_id: "button.roborock_qrevo_edge_pulizia_completa",
    state: "unknown",
    attributes: { friendly_name: "Roborock Qrevo Edge Pulizia completa" },
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    robots: [],
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, robot: true },
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
  /* La linguetta Robot non e' nel documento vendorizzato: la aggiunge il suo
   * modulo quando l'editor si disegna. Si apre la configurazione, si aspetta
   * che compaia, e la si tocca come farebbe un dito. */
  await page.evaluate(() => window.apriConfigEntita());
  const linguetta = page.locator('.ed-tab[data-tab="robot"]');
  await linguetta.waitFor({ state: "visible" });
  await linguetta.click();
  await expect(page.locator("#ed-body .dm-robot-list")).toBeVisible();
}

test("dal menu delle integrazioni nasce il robot gia' compilato", async ({ page }, testInfo) => {
  await boot(page, testInfo);

  /* Il tasto sta in cima alla scheda, sopra l'elenco di sempre. */
  const invito = page.locator("#ed-body [data-robot-integ]");
  await expect(invito).toBeVisible();
  await invito.click();

  const menu = page.locator("#dm-integ-menu");
  await expect(menu).toBeVisible();
  /* Le integrazioni di casa, con i loro dispositivi. */
  await expect(menu.locator('.dm-integ-item[data-domain="roborock"]')).toBeVisible();
  await menu.locator('.dm-integ-item[data-domain="roborock"]').click();
  await menu.locator('.dm-integ-device[data-device-id="rb-1"]').click();

  /* L'anteprima dice cosa ha capito, prima di confermare. */
  const anteprima = menu.locator("[data-preview]");
  await expect(anteprima).toContainText("vacuum.roborock_qrevo_edge");
  await expect(anteprima).toContainText("camera.roborock_qrevo_edge_mappa");
  await expect(anteprima).toContainText("sensor.roborock_qrevo_edge_batteria");
  /* I programmi si contano; le impostazioni del dispositivo no. */
  await expect(anteprima).not.toContainText("number.roborock_qrevo_edge_volume");

  await anteprima.locator("[data-confirm]").click();
  await expect(menu).toHaveCount(0);

  /* Il robot c'e', con dentro quello che il dispositivo ha lasciato capire. */
  const salvato = await page.evaluate(() => {
    const store = window.DashboardModernModules?.store;
    const lista =
      store?.getSection?.("robots") || JSON.parse(localStorage.getItem("cd_robot") || "[]");
    return lista[0] || null;
  });
  expect(salvato).toMatchObject({
    name: "Roborock Qrevo Edge",
    entity: "vacuum.roborock_qrevo_edge",
    mapEntity: "camera.roborock_qrevo_edge_mappa",
    battery: "sensor.roborock_qrevo_edge_batteria",
    /* La stanza la sa gia' Home Assistant: l'area del dispositivo si chiama
     * come una stanza configurata, e il robot ci va dentro da solo. */
    room: "room-salone",
  });
  expect(salvato.comandi).toEqual([
    "button.roborock_qrevo_edge_pulizia_completa",
    "button.roborock_qrevo_edge_solo_lavaggio",
    "select.roborock_qrevo_edge_mocio",
    "switch.roborock_qrevo_edge_blocco_bambini",
  ]);

  /* E la riga si apre da sola, con le caselle piene. */
  const riga = page.locator('#ed-body [data-robot-index="0"]');
  await expect(riga).toBeVisible();
  await expect(riga.locator("#dm-robot-0-entity")).toHaveValue("vacuum.roborock_qrevo_edge");
  await expect(riga.locator("#dm-robot-0-battery")).toHaveValue(
    "sensor.roborock_qrevo_edge_batteria",
  );
});

test("un tagliaerba senza mappa lascia la casella vuota invece di inventarla", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.locator("#ed-body [data-robot-integ]").click();
  const menu = page.locator("#dm-integ-menu");
  await menu.locator('.dm-integ-item[data-domain="roborock"]').click();
  await menu.locator('.dm-integ-device[data-device-id="mw-1"]').click();
  await menu.locator("[data-preview] [data-confirm]").click();

  const salvato = await page.evaluate(() => {
    const store = window.DashboardModernModules?.store;
    const lista =
      store?.getSection?.("robots") || JSON.parse(localStorage.getItem("cd_robot") || "[]");
    return lista[0] || null;
  });
  expect(salvato).toMatchObject({
    name: "Automower 305",
    entity: "lawn_mower.automower_305",
    mapEntity: "",
    battery: "sensor.automower_305_carica",
  });
});

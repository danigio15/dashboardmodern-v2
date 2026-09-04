/* La lavatrice di hOn entra dal menu delle integrazioni, intera.
 *
 * Dal campo: «far in modo che le persone possano integrare i loro
 * elettrodomestici sfruttando le integrazioni, sia ufficiali che presenti su
 * HACS, creando un menu. Io ho la lavatrice Hoover con hOn e mi espone tutti
 * i dati: ogni elettrodomestico avra' sicuramente tutte le sue informazioni.»
 *
 * Qui il backend e' finto e risponde al catalogo con una hOn (da HACS) e una
 * Shelly (ufficiale). Dalla scheda Elettrodomestici si apre il menu, si sceglie
 * la lavatrice, e si pretende che l'apparecchio nasca gia' compilato — tipo,
 * stanza, potenza, tempo rimanente, fase, tasto d'avvio — e che il suo
 * dettaglio mostri anche le entita' che nessuna casella della card legge, coi
 * loro comandi veri.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  device_id: "wm-1",
  platform: "hon",
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
    { domain: "shelly", name: "Shelly", custom: false, devices: 1, entries: [] },
    {
      domain: "hon",
      name: "hOn",
      custom: true,
      devices: 3,
      entries: [{ entry_id: "hon-1", title: "Hoover", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "plug-1",
      name: "Presa frigo",
      manufacturer: "Shelly",
      model: "Plus Plug S",
      integration: "shelly",
      integrations: ["shelly"],
      area_id: "",
      area: "",
      entities: 2,
      disabled: false,
    },
    {
      id: "dw-1",
      name: "Lavastoviglie",
      manufacturer: "Hoover",
      model: "H-DISH 500",
      integration: "hon",
      integrations: ["hon"],
      area_id: "",
      area: "Cucina",
      entities: 2,
      disabled: false,
    },
    {
      id: "td-1",
      name: "Asciugatrice",
      manufacturer: "Hoover",
      model: "H-DRY 500",
      integration: "hon",
      integrations: ["hon"],
      area_id: "a1",
      area: "Lavanderia",
      entities: 3,
      disabled: false,
    },
    {
      id: "wm-1",
      name: "Lavatrice",
      manufacturer: "Hoover",
      model: "H-WASH 500",
      integration: "hon",
      integrations: ["hon"],
      area_id: "a1",
      area: "Lavanderia",
      entities: 10,
      disabled: false,
    },
  ],
  entities: [
    ent("sensor.lavatrice_machine_status", "Machine status", { translation_key: "washing_modes" }),
    ent("sensor.lavatrice_program_phase", "Program phase", {
      translation_key: "program_phases_wm",
    }),
    ent("sensor.lavatrice_remaining_time", "Remaining time", {
      translation_key: "remaining_time",
      unit: "min",
      device_class: "duration",
    }),
    ent("sensor.lavatrice_power", "Power", { unit: "W", device_class: "power" }),
    ent("sensor.lavatrice_energy_total", "Energy total", {
      unit: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    }),
    ent("binary_sensor.lavatrice_door", "Door", { device_class: "door" }),
    ent("switch.lavatrice_wash", "Wash", { translation_key: "wash" }),
    ent("switch.lavatrice_pause", "Pause", { translation_key: "pause" }),
    ent("select.lavatrice_program", "Program", { category: "config" }),
    ent("sensor.lavatrice_rssi", "RSSI", { category: "diagnostic", unit: "dBm" }),
    /* L'asciugatrice non ha nessuna presa smart sotto: niente watt, e la sola
     * cosa che parla e' la parola della fase. */
    ent("sensor.asciugatrice_machine_status", "Machine status", {
      device_id: "td-1",
      translation_key: "washing_modes",
    }),
    ent("sensor.asciugatrice_remaining_time", "Remaining time", {
      device_id: "td-1",
      translation_key: "remaining_time",
      unit: "min",
      device_class: "duration",
    }),
    ent("switch.asciugatrice_dry", "Dry", { device_id: "td-1", translation_key: "dry" }),
    /* La lavastoviglie porta il programma e nient'altro: i watt e il
     * contatore stanno su una presa che e' un altro dispositivo. */
    ent("sensor.lavastoviglie_machine_status", "Machine status", {
      device_id: "dw-1",
      translation_key: "washing_modes",
    }),
    ent("switch.lavastoviglie_lavastoviglie", "Lavastoviglie", { device_id: "dw-1" }),
    ent("switch.presa_frigo", "", { device_id: "plug-1", platform: "shelly" }),
    ent("sensor.presa_frigo_power", "Power", {
      device_id: "plug-1",
      platform: "shelly",
      unit: "W",
    }),
  ],
};

const STATI = [
  {
    entity_id: "sensor.lavatrice_machine_status",
    state: "running",
    attributes: { friendly_name: "Lavatrice Machine status" },
  },
  {
    entity_id: "sensor.lavatrice_program_phase",
    state: "washing",
    attributes: { friendly_name: "Lavatrice Program phase" },
  },
  {
    entity_id: "sensor.lavatrice_remaining_time",
    state: "42",
    attributes: { friendly_name: "Lavatrice Remaining time", unit_of_measurement: "min" },
  },
  {
    entity_id: "sensor.lavatrice_power",
    state: "1900",
    attributes: { friendly_name: "Lavatrice Power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.lavatrice_energy_total",
    state: "412.5",
    attributes: {
      friendly_name: "Lavatrice Energy total",
      unit_of_measurement: "kWh",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "binary_sensor.lavatrice_door",
    state: "off",
    attributes: { friendly_name: "Lavatrice Door", device_class: "door" },
  },
  {
    entity_id: "switch.lavatrice_wash",
    state: "on",
    attributes: { friendly_name: "Lavatrice Wash" },
  },
  {
    entity_id: "switch.lavatrice_pause",
    state: "off",
    attributes: { friendly_name: "Lavatrice Pause" },
  },
  {
    entity_id: "select.lavatrice_program",
    state: "eco_40_60",
    attributes: {
      friendly_name: "Lavatrice Program",
      options: ["eco_40_60", "cotton", "rapid_14"],
    },
  },
  {
    entity_id: "sensor.lavatrice_rssi",
    state: "-61",
    attributes: { friendly_name: "Lavatrice RSSI", unit_of_measurement: "dBm" },
  },
  {
    entity_id: "sensor.asciugatrice_machine_status",
    state: "drying",
    attributes: { friendly_name: "Asciugatrice Machine status" },
  },
  {
    entity_id: "sensor.asciugatrice_remaining_time",
    state: "18",
    attributes: { friendly_name: "Asciugatrice Remaining time", unit_of_measurement: "min" },
  },
  {
    entity_id: "switch.asciugatrice_dry",
    state: "on",
    attributes: { friendly_name: "Asciugatrice Dry" },
  },
  {
    entity_id: "sensor.lavastoviglie_machine_status",
    state: "running",
    attributes: { friendly_name: "Lavastoviglie Machine status" },
  },
  {
    entity_id: "switch.lavastoviglie_lavastoviglie",
    state: "on",
    attributes: { friendly_name: "Lavastoviglie Lavastoviglie" },
  },
  /* I parenti di fuori: la presa e un sensore fatto in casa. Nessuno dei due
   * sta sul dispositivo hOn, e tutti e due portano il suo nome. */
  {
    entity_id: "sensor.lavastoviglie_power",
    state: "980",
    attributes: {
      friendly_name: "Lavastoviglie Potenza",
      unit_of_measurement: "W",
      device_class: "power",
      state_class: "measurement",
    },
  },
  {
    entity_id: "sensor.energy_oggi_lavastoviglie",
    state: "1.24",
    attributes: {
      friendly_name: "energy_oggi_lavastoviglie",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  { entity_id: "switch.presa_frigo", state: "on", attributes: { friendly_name: "Presa frigo" } },
  {
    entity_id: "sensor.presa_frigo_power",
    state: "42",
    attributes: { friendly_name: "Presa frigo power", unit_of_measurement: "W" },
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-cucina", name: "Cucina", icon: "mdi:silverware" },
      { id: "room-lavanderia", name: "Lavanderia", icon: "mdi:washing-machine" },
    ],
    appliances: [],
    loads: [],
  },
  visibility: { appliances: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, catalogo }) => {
      window.__chiamate = [];
      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = MockSocket.OPEN;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
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
          let result = null;
          if (message.type === "get_states") result = haStates;
          else if (message.type === "frontend/get_user_data") result = { value: null };
          else if (message.type === "dashboardmodern/integrations/catalog") {
            const wanted = Array.isArray(message.device_ids) ? message.device_ids : [];
            result = {
              integrations: catalogo.integrations,
              devices: catalogo.devices,
              entities: catalogo.entities.filter((entity) => wanted.includes(entity.device_id)),
            };
          } else if (message.type === "call_service") {
            window.__chiamate.push(message);
            result = {};
          }
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          });
        }
        close() {
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { haStates: STATI, catalogo: CATALOGO },
  );
  await bootNamespacedDashboard(page, variant, testInfo, SEME);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    (haStates) =>
      haStates.forEach((item) => {
        _RAW_STATES[item.entity_id] = structuredClone(item);
        STATES[item.entity_id] = structuredClone(item);
      }),
    STATI,
  );
}

for (const variant of PRIMARY) {
  test(`${variant}: dal menu delle integrazioni nasce la lavatrice già compilata, e il dettaglio la mostra tutta`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "L'editor intero è più lento su WebKit");
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
    });

    /* Il tasto sta in cima alla scheda, sopra la maschera di sempre. */
    const invito = page.locator("#ed-body [data-dm-integ-add]");
    await expect(invito).toBeVisible();
    await invito.click();

    const menu = page.locator("#dm-integ-menu");
    await expect(menu).toBeVisible();
    /* Le due integrazioni, e chi viene da HACS lo dice. */
    const hon = menu.locator('.dm-integ-item[data-domain="hon"]');
    const shelly = menu.locator('.dm-integ-item[data-domain="shelly"]');
    await expect(hon).toBeVisible();
    await expect(hon.locator(".dm-integ-badge-hacs")).toHaveCount(1);
    await expect(shelly.locator(".dm-integ-badge-core")).toHaveCount(1);
    await hon.click();

    const lavatrice = menu.locator('.dm-integ-device[data-device-id="wm-1"]');
    await expect(lavatrice).toBeVisible();
    await expect(lavatrice).toContainText("Hoover H-WASH 500");
    await expect(lavatrice).toContainText("Lavanderia");
    await expect(menu.locator('.dm-integ-device[data-device-id="plug-1"]')).toHaveCount(0);
    await lavatrice.click();

    /* L'anteprima dice cosa ha capito e cosa portera' dentro. */
    const anteprima = menu.locator("[data-preview]");
    await expect(anteprima).toContainText(/Lavatrice|Washing machine/);
    await expect(anteprima.locator(".dm-integ-chip")).toHaveCount(10);
    await anteprima.locator("[data-confirm]").click();
    await expect(menu).toHaveCount(0);

    /* L'apparecchio e' nato compilato, e il collegamento e' in memoria. */
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem("dm_dashboard_state") || "{}");
          const item = state.sections?.appliances?.[0] || {};
          return {
            name: item.name,
            visual: item.visual_key,
            room: item.room_id,
            device: item.device_id,
            integration: item.integration,
            integrationName: item.integration_name,
            model: item.device_model,
            power: item.power_entity,
            remaining: item.remaining_entity,
            state: item.state_entity,
            control: item.control_entity,
            total: item.total_energy_entity,
            snapshot: (item.device_entities || []).length,
          };
        }),
      )
      .toEqual({
        name: "Lavatrice",
        visual: "lavatrice",
        room: "room-lavanderia",
        device: "wm-1",
        integration: "hon",
        integrationName: "hOn",
        model: "H-WASH 500",
        power: "sensor.lavatrice_power",
        remaining: "sensor.lavatrice_remaining_time",
        state: "sensor.lavatrice_machine_status",
        control: "switch.lavatrice_wash",
        total: "sensor.lavatrice_energy_total",
        snapshot: 10,
      });

    /* La finestra di modifica si apre da sola, col blocco del collegamento. */
    const modal = page.locator("#dm-appliance-editor-modal");
    await expect(modal).toBeVisible();
    const blocco = modal.locator("[data-binding]");
    await expect(blocco).toHaveAttribute("data-bound", "true");
    await expect(blocco.locator("[data-binding-title]")).toContainText("hOn");
    await expect(modal.locator('input[name="remaining_entity"]')).toHaveValue(
      "sensor.lavatrice_remaining_time",
    );
    await expect(modal.locator("[data-type-trigger]")).toContainText(/Lavatrice|Washing machine/);
    await modal.locator("[data-close]").click();
    await expect(modal).toHaveCount(0);

    /* Nella scheda la riga porta la spilla dell'integrazione. */
    await expect(page.locator("#ed-body .ed-row .dm-integ-pin").first()).toContainText("hOn");

    /* Il dettaglio: la parte curata, e sotto tutto il dispositivo. */
    await page.evaluate(() => {
      window.chiudiConfig?.();
      window.apriApplianceDetail(0);
    });
    const dettaglio = page.locator("#details-modal");
    await expect(dettaglio).toHaveClass(/show/);
    const lista = dettaglio.locator("#details-list");
    await expect(lista.locator(".dm-apde-integrazione")).toContainText("hOn");
    await expect(lista.locator(".dm-apde-integrazione")).toContainText("Hoover H-WASH 500");
    /* La fase e l'oblo' non stanno in nessuna casella della card: escono qui. */
    await expect(
      lista.locator('.dm-apde-pillola[data-dm-apde-entity="sensor.lavatrice_program_phase"]'),
    ).toContainText("washing");
    await expect(
      lista.locator('.dm-apde-pillola[data-dm-apde-entity="binary_sensor.lavatrice_door"]'),
    ).toHaveCount(1);
    /* La pausa e' un interruttore vero, il programma un menu vero. */
    await expect(
      lista.locator(
        '.dm-apde-comando[data-dm-apde-entity="switch.lavatrice_pause"] .dm-apde-tasto',
      ),
    ).toHaveText("ON");
    const programma = lista.locator(
      '.dm-apde-comando[data-dm-apde-entity="select.lavatrice_program"] select',
    );
    await expect(programma).toHaveValue("eco_40_60");
    await expect(programma.locator("option")).toHaveCount(3);
    await programma.selectOption("cotton");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__chiamate
            .filter((call) => call.domain === "select")
            .map((call) => [call.service, call.target?.entity_id, call.service_data?.option]),
        ),
      )
      .toEqual([["select_option", "select.lavatrice_program", "cotton"]]);
    /* La diagnostica sta in fondo, chiusa. */
    const diagnostica = lista.locator("details.dm-apde-diagnostica");
    await expect(diagnostica).toHaveCount(1);
    await expect(diagnostica).not.toHaveAttribute("open", "");
    await expect(
      diagnostica.locator('[data-dm-apde-entity="sensor.lavatrice_rssi"]'),
    ).toContainText("-61 dBm");
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: senza sensore di potenza, la fase del programma dice IN FUNZIONE`, async ({
    page,
  }, testInfo) => {
    /* Dal campo: «prevedi che se non viene messo il sensore potenza il cambio
     * stato acceso e in funzione lo devi capire dagli stati dei programmi».
     * L'asciugatrice di questo catalogo non ha nessuna presa smart sotto: se
     * la card leggesse solo i watt direbbe SPENTO per tutto il ciclo. */
    test.setTimeout(150_000);
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "L'editor intero è più lento su WebKit");
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
    });
    await page.locator("#ed-body [data-dm-integ-add]").click();
    const menu = page.locator("#dm-integ-menu");
    await menu.locator('.dm-integ-item[data-domain="hon"]').click();
    await menu.locator('.dm-integ-device[data-device-id="td-1"]').click();
    await menu.locator("[data-preview] [data-confirm]").click();
    await expect(page.locator("#dm-appliance-editor-modal")).toBeVisible();

    /* Nessuna casella della potenza: non c'era niente da metterci. Lo stato e
     * il tempo rimanente si', e sono quelli che devono bastare. */
    await expect(page.locator('#dm-appliance-editor-modal input[name="power_entity"]')).toHaveValue(
      "",
    );
    await expect(page.locator('#dm-appliance-editor-modal input[name="state_entity"]')).toHaveValue(
      "sensor.asciugatrice_machine_status",
    );
    await page.locator("#dm-appliance-editor-modal [data-close]").click();

    await page.evaluate(() => {
      document.getElementById("editor-modal")?.remove();
      document.querySelector('.tab[data-tab="appliances-main"]')?.click();
    });
    const card = page
      .locator(".dm-ap-card[data-appliance-id]", { hasText: "Asciugatrice" })
      .first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(/IN FUNZIONE|RUNNING/);

    /* E quando il ciclo finisce, la stessa parola la spegne. */
    await page.evaluate(() => {
      const finita = {
        entity_id: "sensor.asciugatrice_machine_status",
        state: "end",
        attributes: { friendly_name: "Asciugatrice Machine status" },
      };
      _RAW_STATES[finita.entity_id] = structuredClone(finita);
      STATES[finita.entity_id] = structuredClone(finita);
      window.renderApplianceSection?.(true);
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    });
    await expect(card).toContainText(/SPENTO|OFF/, { timeout: 15000 });
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: i sensori fuori dal dispositivo si vedono prima di prenderli`, async ({
    page,
  }, testInfo) => {
    /* Una lavatrice puo' essere due dispositivi: l'integrazione che porta il
     * programma e una presa smart che porta i watt. Il menu se ne accorge, lo
     * dice per nome, e lascia decidere: e' un'ipotesi basata sul nome, e
     * un'ipotesi si guarda prima di accettarla. */
    test.setTimeout(150_000);
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "L'editor intero è più lento su WebKit");
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
    });
    await page.locator("#ed-body [data-dm-integ-add]").click();
    const menu = page.locator("#dm-integ-menu");
    await menu.locator('.dm-integ-item[data-domain="hon"]').click();
    await menu.locator('.dm-integ-device[data-device-id="dw-1"]').click();

    /* Il riquadro dice quanti sono e quali, e parte spuntato. */
    const fuori = menu.locator(".dm-integ-fuori");
    await expect(fuori).toBeVisible();
    await expect(fuori).toContainText("2");
    await expect(fuori).toContainText("sensor.lavastoviglie_power");
    await expect(fuori).toContainText("sensor.energy_oggi_lavastoviglie");
    await expect(fuori.locator("[data-outside]")).toBeChecked();

    await menu.locator("[data-preview] [data-confirm]").click();
    const modal = page.locator("#dm-appliance-editor-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[name="power_entity"]')).toHaveValue(
      "sensor.lavastoviglie_power",
    );
    await expect(modal.locator('input[name="daily_energy_entity"]')).toHaveValue(
      "sensor.energy_oggi_lavastoviglie",
    );
    /* E quello del dispositivo resta quello del dispositivo. */
    await expect(modal.locator('input[name="control_entity"]')).toHaveValue(
      "switch.lavastoviglie_lavastoviglie",
    );
    await modal.locator("[data-close]").click();
  });

  test(`${variant}: togliendo la spunta, i sensori di fuori restano fuori`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    if (testInfo.project.name === "webkit-ipad")
      test.slow(true, "L'editor intero è più lento su WebKit");
    await boot(page, variant, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
    });
    await page.locator("#ed-body [data-dm-integ-add]").click();
    const menu = page.locator("#dm-integ-menu");
    await menu.locator('.dm-integ-item[data-domain="hon"]').click();
    await menu.locator('.dm-integ-device[data-device-id="dw-1"]').click();
    await menu.locator(".dm-integ-fuori [data-outside]").uncheck();
    await menu.locator("[data-preview] [data-confirm]").click();

    const modal = page.locator("#dm-appliance-editor-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[name="power_entity"]')).toHaveValue("");
    await expect(modal.locator('input[name="daily_energy_entity"]')).toHaveValue("");
    await expect(modal.locator('input[name="control_entity"]')).toHaveValue(
      "switch.lavastoviglie_lavastoviglie",
    );
    await modal.locator("[data-close]").click();
  });
}

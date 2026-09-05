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

/* Dall'editor alla sezione: si chiude la configurazione e si accende la
 * pagina, come fa il dito toccando la voce nella barra. */
async function apriLaPaginaRobot(page) {
  await page.evaluate(() => {
    const modale = document.getElementById("editor-modal");
    if (modale) {
      modale.classList.remove("show");
      modale.style.display = "none";
    }
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-robot")?.classList.add("active");
    window.DashboardModernModules?.robot?.render?.();
  });
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

/* Il seguito del giro: il robot nato dall'integrazione, guardato sulla sua
 * pagina. Due cose che si vedono solo li'. */
test("sulla card la stanza si legge col suo nome, non con l'identificativo", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.locator("#ed-body [data-robot-integ]").click();
  const menu = page.locator("#dm-integ-menu");
  await menu.locator('.dm-integ-item[data-domain="roborock"]').click();
  await menu.locator('.dm-integ-device[data-device-id="rb-1"]').click();
  await menu.locator("[data-preview] [data-confirm]").click();
  await expect(menu).toHaveCount(0);

  await apriLaPaginaRobot(page);
  const card = page.locator("#page-robot .dm-robot-card").first();
  await expect(card).toBeVisible();
  /* La configurazione salva l'ID — e' l'unica cosa che regge un rinominamento
   * — e da quando il robot nasce dall'integrazione quell'id lo scrive il
   * legame col dispositivo. Sotto al titolo pero' ci va il nome: «room-salone»
   * non e' una stanza, e' una chiave. */
  await expect(card.locator(".dm-robot-title small")).toHaveText("Salone");
});

test("la mappa si scorre anche a misura d'apertura, non solo da ingrandita", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.locator("#ed-body [data-robot-integ]").click();
  const menu = page.locator("#dm-integ-menu");
  await menu.locator('.dm-integ-item[data-domain="roborock"]').click();
  await menu.locator('.dm-integ-device[data-device-id="rb-1"]').click();
  await menu.locator("[data-preview] [data-confirm]").click();
  await expect(menu).toHaveCount(0);

  await apriLaPaginaRobot(page);
  /* La mappa arriva come arriva davvero: un `entity_picture` sulla telecamera,
   * che la card va a prendere da se'. Il disegno non conta — conta il gesto. */
  await page.evaluate(() => {
    const disegno =
      "data:image/svg+xml;base64," +
      btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#dbeafe"/></svg>',
      );
    for (const registro of [_RAW_STATES, STATES])
      registro["camera.roborock_qrevo_edge_mappa"] = {
        entity_id: "camera.roborock_qrevo_edge_mappa",
        state: "idle",
        attributes: { friendly_name: "Mappa", entity_picture: disegno },
      };
    window.DashboardModernModules?.robot?.render?.();
  });
  const mappa = page.locator("#page-robot [data-dm-robot-map]");
  await expect(mappa).toHaveAttribute("data-dm-map-state", "ready", { timeout: 15_000 });
  await mappa.click();
  const visore = page.locator("#dm-robot-map-view");
  await expect(visore).toBeVisible();

  const figura = visore.locator("img");
  const prima = await figura.evaluate((n) => n.style.transform);
  /* Nessuno ha toccato la rotella: si e' alla misura d'apertura, ed e'
   * esattamente il caso in cui prima non si muoveva niente. */
  expect(prima === "" || /scale\(1\)/.test(prima)).toBe(true);

  const palco = visore.locator(".dm-robot-map-stage");
  const riquadro = await palco.boundingBox();
  const cx = riquadro.x + riquadro.width / 2;
  const cy = riquadro.y + riquadro.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 90, cy - 40, { steps: 8 });
  await page.mouse.up();

  const spostamento = async () => {
    const scritto = await figura.evaluate((n) => n.style.transform);
    const [, x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(scritto) || [];
    return { scritto, x: Number(x || 0), y: Number(y || 0) };
  };

  /* Il punto della segnalazione: a misura d'apertura il trascinamento non
   * muoveva niente. Adesso muove, e in tutte e due le direzioni. */
  const dopo = await spostamento();
  expect(dopo.x, `la mappa non si e' mossa: ${dopo.scritto}`).toBeLessThan(0);
  expect(dopo.y, `la mappa non si e' mossa in verticale: ${dopo.scritto}`).toBeLessThan(0);

  /* E a fermarla c'e' un limite, non un divieto: per quanto si trascini, la
   * mappa non si puo' portare via dallo schermo. */
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 4000, cy - 4000, { steps: 10 });
  await page.mouse.up();
  const strappata = await spostamento();
  const riquadroFinale = await palco.boundingBox();
  expect(
    Math.abs(strappata.x),
    `la mappa e' uscita dallo schermo: ${strappata.scritto}`,
  ).toBeLessThan(riquadroFinale.width);
  expect(
    Math.abs(strappata.y),
    `la mappa e' uscita dallo schermo: ${strappata.scritto}`,
  ).toBeLessThan(riquadroFinale.height);
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

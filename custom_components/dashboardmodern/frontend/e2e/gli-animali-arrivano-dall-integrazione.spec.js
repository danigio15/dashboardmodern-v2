/* Gli animali di casa arrivano dal menu delle integrazioni (#358).
 *
 * «Sarebbe utile ed interessante avere una nuova sezione per chi ha animali
 * domestici, magari in grado di collegarsi a varie integrazioni come ad
 * esempio PetKit… lettiera, livello del distributore di cibo e così via.»
 *
 * È lo stesso giro degli elettrodomestici e del robot: si sceglie
 * l'integrazione, si sceglie il dispositivo, e la scheda nasce con le caselle
 * già piene. La differenza sta tutta nell'animale: le sue cose vivono su più
 * dispositivi, e il secondo si somma al primo. Qui si guarda il risultato —
 * la riga nella scheda Animali, e poi la card sulla pagina, con in cima quello
 * che serve a colpo d'occhio.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ent = (entity_id, name, device_id, extra = {}) => ({
  entity_id,
  device_id,
  platform: "petkit",
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
      domain: "petkit",
      name: "PetKit",
      custom: true,
      devices: 1,
      entries: [{ entry_id: "pk", title: "PetKit", state: "loaded" }],
    },
    {
      domain: "litterrobot",
      name: "Litter-Robot",
      custom: false,
      devices: 1,
      entries: [{ entry_id: "lr", title: "Litter-Robot", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "pk-1",
      name: "Ciotola di Micio",
      manufacturer: "PetKit",
      model: "Fresh Element",
      integration: "petkit",
      integrations: ["petkit"],
      area_id: "a1",
      area: "Cucina",
      entities: 5,
      disabled: false,
    },
    {
      id: "lr-1",
      name: "Litter-Robot 4",
      manufacturer: "Whisker",
      model: "LR4",
      integration: "litterrobot",
      integrations: ["litterrobot"],
      area_id: "",
      area: "",
      entities: 3,
      disabled: false,
    },
  ],
  entities: [
    ent("sensor.petkit_food_level", "Food level", "pk-1", { unit: "%" }),
    ent("sensor.petkit_last_feed", "Last feed", "pk-1"),
    ent("sensor.petkit_portions_today", "Portions dispensed today", "pk-1"),
    /* Le impostazioni del dispositivo non sono cose dell'animale. */
    ent("number.petkit_volume", "Volume", "pk-1", { category: "config" }),
    ent("sensor.petkit_rssi", "Signal strength", "pk-1", { category: "diagnostic" }),
    ent("sensor.litter_robot_waste_drawer", "Waste drawer level", "lr-1", {
      platform: "litterrobot",
      unit: "%",
    }),
    ent("sensor.litter_robot_last_clean", "Last clean cycle", "lr-1", { platform: "litterrobot" }),
    ent("sensor.litter_robot_uses_today", "Uses today", "lr-1", { platform: "litterrobot" }),
  ],
};

/* Il cibo agli sgoccioli e la lettiera non pulita da due giorni: le due cose
 * che la scheda deve dire a colpo d'occhio. */
const STATI = [
  {
    entity_id: "sensor.petkit_food_level",
    state: "8",
    attributes: { friendly_name: "Food level", unit_of_measurement: "%" },
  },
  {
    entity_id: "sensor.petkit_last_feed",
    state: "2026-02-28T08:00:00Z",
    attributes: { friendly_name: "Last feed" },
  },
  {
    entity_id: "sensor.petkit_portions_today",
    state: "3",
    attributes: { friendly_name: "Portions dispensed today" },
  },
  {
    entity_id: "sensor.litter_robot_waste_drawer",
    state: "91",
    attributes: { friendly_name: "Waste drawer level", unit_of_measurement: "%" },
  },
  {
    entity_id: "sensor.litter_robot_last_clean",
    state: "2020-01-01T00:00:00Z",
    attributes: { friendly_name: "Last clean cycle" },
  },
  {
    entity_id: "sensor.litter_robot_uses_today",
    state: "4",
    attributes: { friendly_name: "Uses today" },
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "🍽️", metadata: {} }],
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
  visibility: { home: true, animali: true },
};

async function boot(page, testInfo) {
  test.setTimeout(90_000);
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
  /* La linguetta Animali non è nel documento vendorizzato: la aggiunge il suo
   * modulo quando l'editor si disegna. */
  await page.evaluate(() => window.apriConfigEntita());
  const linguetta = page.locator('.ed-tab[data-tab="animali"]');
  await linguetta.waitFor({ state: "visible" });
  await linguetta.click();
  await expect(page.locator("#ed-body .dm-animale-list")).toBeVisible();
}

async function collega(page, dominio, dispositivo) {
  const menu = page.locator("#dm-integ-menu");
  await expect(menu).toBeVisible();
  await menu.locator(`.dm-integ-item[data-domain="${dominio}"]`).click();
  await menu.locator(`.dm-integ-device[data-device-id="${dispositivo}"]`).click();
  const anteprima = menu.locator("[data-preview]");
  await expect(anteprima.locator("[data-confirm]")).toBeVisible();
  return anteprima;
}

/* Dall'editor alla sezione: si chiude la configurazione e si accende la
 * pagina, come fa il dito toccando la voce nella barra. */
async function apriLaPaginaAnimali(page) {
  await page.evaluate(() => {
    const modale = document.getElementById("editor-modal");
    if (modale) {
      modale.classList.remove("show");
      modale.style.display = "none";
    }
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-animali")?.classList.add("active");
  });
}

test("dal menu delle integrazioni nasce l'animale già compilato", async ({ page }, testInfo) => {
  await boot(page, testInfo);

  await page.locator("#ed-body [data-animale-integ]").click();
  const anteprima = await collega(page, "petkit", "pk-1");
  /* L'anteprima dice cosa ha capito, prima di confermare. */
  await expect(anteprima).toContainText("sensor.petkit_food_level");
  await expect(anteprima).toContainText("sensor.petkit_last_feed");
  /* Le impostazioni del dispositivo non entrano. */
  await expect(anteprima).not.toContainText("number.petkit_volume");
  await expect(anteprima).not.toContainText("sensor.petkit_rssi");

  await anteprima.locator("[data-confirm]").click();
  await expect(page.locator("#dm-integ-menu")).toHaveCount(0);

  const salvato = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_animali") || "[]")[0] || null,
  );
  expect(salvato).toMatchObject({
    nome: "Ciotola di Micio",
    cibo_livello: "sensor.petkit_food_level",
    cibo_ultima: "sensor.petkit_last_feed",
    cibo_porzioni: "sensor.petkit_portions_today",
    /* La stanza la sa già Home Assistant: l'area del dispositivo si chiama
     * come una stanza configurata, e l'animale ci va dentro da solo. */
    stanza: "room-cucina",
  });

  /* E la riga si apre da sola, con le caselle piene. */
  const riga = page.locator('#ed-body [data-animale-index="0"]');
  await expect(riga).toBeVisible();
  await expect(riga.locator("#dm-animale-0-cibo_livello")).toHaveValue("sensor.petkit_food_level");
});

test("un secondo dispositivo si somma al primo, e la card lo dice tutto insieme", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);

  await page.locator("#ed-body [data-animale-integ]").click();
  await (await collega(page, "petkit", "pk-1")).locator("[data-confirm]").click();
  await expect(page.locator("#dm-integ-menu")).toHaveCount(0);

  /* Il secondo tasto sta dentro la riga: collega un dispositivo IN PIÙ. */
  const riga = page.locator('#ed-body [data-animale-index="0"]');
  await riga.locator("[data-animale-integ-riga]").click();
  await (await collega(page, "litterrobot", "lr-1")).locator("[data-confirm]").click();
  await expect(page.locator("#dm-integ-menu")).toHaveCount(0);

  const salvato = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_animali") || "[]")[0] || null,
  );
  expect(salvato).toMatchObject({
    cibo_livello: "sensor.petkit_food_level",
    lettiera_riempimento: "sensor.litter_robot_waste_drawer",
    lettiera_ultima: "sensor.litter_robot_last_clean",
    lettiera_visite: "sensor.litter_robot_uses_today",
  });
  expect(salvato.dispositivi.map((voce) => voce.id)).toEqual(["pk-1", "lr-1"]);

  /* Sulla pagina: una card sola, con le due famiglie dentro e, in cima, le
   * cose che si devono sapere a colpo d'occhio. */
  await apriLaPaginaAnimali(page);
  const card = page.locator("#page-animali .dm-animale-card").first();
  await expect(card).toBeVisible();
  /* La stanza si legge col suo nome, non con l'identificativo. */
  await expect(card.locator(".dm-animale-titolo small")).toHaveText("Gatto · Cucina");
  await expect(card.locator("[data-dm-animale-lettura='cibo_livello']")).toContainText("8 %");
  await expect(card.locator("[data-dm-animale-lettura='lettiera_visite']")).toContainText("4");
  await expect(card.locator("[data-dm-animale-avviso='cibo_scarso']")).toBeVisible();
  await expect(card.locator("[data-dm-animale-avviso='lettiera_piena']")).toBeVisible();
  await expect(card.locator("[data-dm-animale-avviso='lettiera_da_pulire']")).toBeVisible();
  await expect(card).toHaveAttribute("data-gravita", "urgente");
});

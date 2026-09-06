/* La TV entra dal menu delle integrazioni e la scheda dice se e' accesa (#354).
 *
 * «La TV e' accesa e risulta dall'integrazione sotto in basso allo
 * screenshot, ma risulta spenta nella scheda. E' possibile associare le due
 * cose in modo che lo stato sia coerente e corretto?»
 *
 * Il backend finto porta un televisore LG webOS: un `media_player` e un
 * `remote`, niente altro. Dalla scheda Elettrodomestici si collega, e si
 * pretende che la card legga lo stato dal lettore — IN FUNZIONE quando e'
 * acceso, SPENTO quando si spegne — e che il tasto della card sia il suo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  device_id: "tv-1",
  platform: "webostv",
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
      domain: "webostv",
      name: "LG webOS TV",
      custom: false,
      devices: 1,
      entries: [{ entry_id: "lg-1", title: "TV Salotto", state: "loaded" }],
    },
  ],
  devices: [
    {
      id: "tv-1",
      name: "TV Salotto",
      manufacturer: "LG",
      model: "OLED55C4",
      integration: "webostv",
      integrations: ["webostv"],
      area_id: "",
      area: "",
      entities: 2,
      disabled: false,
    },
  ],
  entities: [ent("media_player.tv_salotto", "TV Salotto"), ent("remote.tv_salotto", "TV Salotto")],
};

const STATI = [
  {
    entity_id: "media_player.tv_salotto",
    state: "on",
    attributes: { friendly_name: "TV Salotto", supported_features: 152461, source: "Netflix" },
  },
  { entity_id: "remote.tv_salotto", state: "on", attributes: { friendly_name: "TV Salotto" } },
];

const SEME = {
  schema_version: 4,
  sections: { rooms: [], appliances: [], loads: [] },
  visibility: { appliances: true },
};

async function boot(page, testInfo) {
  test.setTimeout(150_000);
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
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
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

test("dal menu delle integrazioni nasce la TV, e la scheda dice quello che dice il lettore", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
  });
  await page.locator("#ed-body [data-dm-integ-add]").click();
  const menu = page.locator("#dm-integ-menu");
  await expect(menu).toBeVisible();
  await menu.locator('.dm-integ-item[data-domain="webostv"]').click();
  await menu.locator('.dm-integ-device[data-device-id="tv-1"]').click();
  const anteprima = menu.locator("[data-preview]");
  await expect(anteprima).toContainText(/TV/);
  await anteprima.locator("[data-confirm]").click();
  await expect(menu).toHaveCount(0);

  /* Il lettore e' lo stato del televisore, e anche il suo tasto. */
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem("dm_dashboard_state") || "{}");
        const item = state.sections?.appliances?.[0] || {};
        return {
          visual: item.visual_key,
          state: item.state_entity,
          control: item.control_entity,
          integration: item.integration,
        };
      }),
    )
    .toEqual({
      visual: "tv",
      state: "media_player.tv_salotto",
      control: "media_player.tv_salotto",
      integration: "webostv",
    });

  const modal = page.locator("#dm-appliance-editor-modal");
  await expect(modal).toBeVisible();
  await modal.locator("[data-close]").click();
  await expect(modal).toHaveCount(0);

  /* Si va a guardarla nella sua pagina: la sezione ridisegna le card ai
   * cambi di stato solo mentre e' davanti agli occhi. */
  await page.evaluate(() => {
    window.chiudiConfig?.();
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-appliances-main")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  /* La TV e' accesa: la card lo dice. */
  const scheda = page.locator(".dm-ap-card[data-appliance-id]").first();
  await expect(scheda).toHaveAttribute("data-mode", "running");
  await expect(scheda.locator(".dm-ap-badge")).toContainText(/IN FUNZIONE|RUNNING/);
  await expect(scheda.locator("[data-dm-power-toggle]")).toHaveCount(1);

  /* Si spegne: la card la segue, senza aspettare altro. */
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, STATES]) {
      registro["media_player.tv_salotto"] = {
        ...registro["media_player.tv_salotto"],
        state: "off",
      };
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(scheda).toHaveAttribute("data-mode", "off");
  await expect(scheda.locator(".dm-ap-badge")).toContainText(/SPENTO|OFF/);
});

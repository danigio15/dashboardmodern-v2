/* «Nel menu di configurazione, rientrando, il Motore risulta Elettrica anche
 * se avevo scelto termico» (#326).
 *
 * Chi segnala ha una Hyundai Tucson a benzina, le caselle compilate nella
 * mappatura generale della plancia e nessun profilo auto — che e' la
 * configurazione di chi ha una macchina sola. Il tipo di motore viveva solo
 * dentro un profilo, quindi la sua scelta non aveva dove andare: spariva, e
 * con lei sparivano le altre due cose che dipendono da lei — la SESSIONE
 * RICARICA che restava in pagina, e la batteria del mild-hybrid che non si
 * vedeva.
 *
 * Qui si rifa' il suo giro: si sceglie «Termica», si chiude la
 * configurazione, la si riapre. E si guarda la pagina Auto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Nessun profilo auto: le caselle stanno nella mappatura generale, come le
 * compila chi ha una macchina sola. */
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
    entityOverrides: {
      "dm.ev_carburante": "sensor.tucson_carburante",
      "dm.ev_autonomia": "sensor.tucson_autonomia",
      "dm.ev_batteria_auto": "sensor.tucson_batteria",
    },
  },
  visibility: { ev: true },
};

const STATI = [
  {
    entity_id: "sensor.tucson_carburante",
    state: "62",
    attributes: { unit_of_measurement: "%", friendly_name: "TUCSON Fuel level" },
  },
  {
    entity_id: "sensor.tucson_autonomia",
    state: "430",
    attributes: { unit_of_measurement: "km", friendly_name: "TUCSON Range" },
  },
  {
    entity_id: "sensor.tucson_batteria",
    state: "78",
    attributes: { unit_of_measurement: "%", friendly_name: "TUCSON Car battery" },
  },
];

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((stati) => {
    class MockBridgeSocket extends EventTarget {
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
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = stati;
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => Boolean(eval("_RAW_STATES")["sensor.tucson_carburante"]));
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

/* Apre la configurazione sulla scheda Auto, come ci si arriva col dito. */
async function apriLaSchedaAuto(page) {
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await expect(page.locator("#ed-body select[data-ev-tipo]")).toHaveCount(1);
}

async function chiudiLaConfigurazione(page) {
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
}

test.describe("il motore scelto resta scelto (#326)", () => {
  test("senza profilo auto: si sceglie termica, si riapre, ed e' ancora termica", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    await apriLaSchedaAuto(page);
    /* Di serie e' elettrica, che e' quello che ogni plancia configurata finora
     * e': non le si chiede di dichiararlo. */
    await expect(page.locator("#ed-body select[data-ev-tipo]")).toHaveValue("");

    await page.selectOption("#ed-body select[data-ev-tipo]", "termica");
    await chiudiLaConfigurazione(page);

    /* Riaprire e' il gesto della segnalazione: «rientrando risulta Elettrica». */
    await apriLaSchedaAuto(page);
    await expect(page.locator("#ed-body select[data-ev-tipo]")).toHaveValue("termica");
    await chiudiLaConfigurazione(page);

    /* E la pagina racconta la stessa auto: niente ricarica, il serbatoio al
     * suo posto. */
    await expect(page.locator("#page-ev")).toHaveAttribute("data-dm-motore", "termica");
    await expect(page.locator("#page-ev .dm-termica-serbatoio")).toHaveCount(1);
  });

  test("con motore termico la SESSIONE RICARICA sparisce e la batteria resta", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    await apriLaSchedaAuto(page);
    await page.selectOption("#ed-body select[data-ev-tipo]", "termica");
    await chiudiLaConfigurazione(page);
    await expect(page.locator("#page-ev")).toHaveAttribute("data-dm-motore", "termica");

    /* «Con motore termico non deve essere mostrata la SESSIONE RICARICA»: un
     * pieno di benzina non ha ne' sessione, ne' target, ne' colonnina. */
    await expect(page.locator("#page-ev .lm-session-card")).toBeHidden();
    await expect(page.locator("#page-ev .lm-target-card")).toBeHidden();
    await expect(page.locator("#page-ev .lm-kpi-row")).toBeHidden();
    await expect(page.locator("#page-ev #lm-charge-badge")).toBeHidden();

    /* «La scheda batteria dovrebbe mostrare solo la percentuale di carica»:
     * e' quella del mild-hybrid, e la percentuale la dice. */
    await expect(page.locator("#page-ev")).toHaveAttribute("data-dm-batteria", "true");
    await expect(page.locator("#page-ev .lm-batt-section").first()).toBeVisible();
    await expect(page.locator("#page-ev .lm-batt-section .v-ev-soc-txt").first()).toContainText(
      "78",
    );
    /* E delle tre righe che parlano di colonnina non resta niente. */
    await expect(page.locator("#page-ev .dm-evv-rows")).toBeHidden();
  });

  test("una lettura rinominata in configurazione si chiama cosi' anche sulla card", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    await apriLaSchedaAuto(page);
    await page.selectOption("#ed-body select[data-ev-tipo]", "termica");
    /* «Le etichette possono essere modificabili? Nel mio caso tutto quello che
     * inizia con TUCSON.» La riga della casella ha la scritta modificabile: si
     * batte il nome e si esce dal campo, come si fa col dito. */
    await page.evaluate(() => window.wzRenameSlot("dm.ev_autonomia", "Quanto posso fare"));
    await chiudiLaConfigurazione(page);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
    );
    await expect(
      page.locator('#page-ev .dm-termica-misura[data-dm-storico="dm.ev_autonomia"]'),
    ).toContainText("Quanto posso fare");
  });
});

/* «Sto provando ad integrare l'asciugatrice con hOn» (#338).
 *
 *     «Non ha un'entità comando, ma da documentazione posso far partire il
 *      comando con service: hon.start_program, data: {program: rapid_30},
 *      target: {device_id: …}. Come posso integrare questo nella sezione
 *      dell'asciugatrice?»
 *
 * Una chiamata di servizio con i suoi parametri non e' un'entita', e la
 * finestra sapeva premere solo entita'. Avvolta in uno script pero' lo
 * diventa. Qui si fa il giro intero, come lo fa lui: si apre la scheda
 * dell'asciugatrice, si aggiunge `script.asciugatrice_rapido_30` fra gli
 * «Altri comandi», si salva, si apre la finestra e si preme il tasto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("sensor.asciugatrice_potenza", "1240", {
    friendly_name: "Asciugatrice Potenza",
    unit_of_measurement: "W",
  }),
  stato("script.asciugatrice_rapido_30", "off", {
    friendly_name: "Asciugatrice Rapido 30",
  }),
  stato("script.asciugatrice_cotone", "off", { friendly_name: "Asciugatrice Cotone" }),
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    appliances: [
      {
        id: "appl-asciugatrice",
        name: "Asciugatrice",
        type: "asciugatrice",
        icon: "asciugatrice",
        power_entity: "sensor.asciugatrice_potenza",
        entities: ["sensor.asciugatrice_potenza"],
      },
    ],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

async function boot(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Un ponte finto che risponde agli stati e SI RICORDA i comandi: e' il modo
   * di vedere che cosa il tasto manda davvero a Home Assistant. */
  await page.addInitScript((haStates) => {
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
        else if (messaggio.type === "call_service") {
          (window.__comandi ||= []).push(messaggio);
          risultato = {};
        }
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
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((haStates) => {
    for (const voce of haStates) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    window.render?.();
  }, STATI);
}

test.describe("gli altri comandi dell'elettrodomestico (#338)", () => {
  test("si aggiunge uno script dalla scheda e diventa un tasto nella finestra", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
      window.edApplEdit(0);
    });
    const modale = page.locator("#dm-appliance-editor-modal");
    await expect(modale.locator("[data-appl-comandi]")).toHaveCount(1);
    /* Di serie non ce n'e' nessuno, e la scheda lo dice invece di lasciare un
     * buco. */
    await expect(modale.locator(".dm-appl-cmd-vuoto")).toHaveCount(1);

    /* Il campo e' un campo entita' come gli altri della configurazione: la
     * pastiglia «Scegli entità» apre la ricerca di casa, la matita lo apre da
     * scrivere a mano. Qui si scrive a mano, che e' la strada di chi sa gia'
     * come si chiama il suo script. */
    const casella = modale.locator("[data-appl-comando-nuovo]");
    await modale.locator("[data-appl-comandi] .dm-chip-manual").click();
    await expect(casella).toBeVisible();

    /* Un'entita' che non sa fare da comando viene rifiutata, e la scheda dice
     * quali servono: e' meglio di un tasto che poi non fa niente. */
    await casella.fill("sensor.asciugatrice_potenza");
    await modale.locator("[data-appl-cmd-add]").click();
    await expect(modale.locator("[data-appl-cmd-error]")).not.toBeEmpty();
    await expect(modale.locator(".dm-appl-cmd-chip")).toHaveCount(0);

    /* Lo script invece si': e' la scatola in cui `hon.start_program` sta. */
    await casella.fill("script.asciugatrice_rapido_30");
    await modale.locator("[data-appl-cmd-add]").click();
    await expect(modale.locator("[data-appl-cmd-error]")).toBeEmpty();
    /* La pastiglia porta il nome senza ripetere «Asciugatrice», che sta gia'
     * in testa alla finestra. */
    await expect(modale.locator(".dm-appl-cmd-chip")).toHaveCount(1);
    await expect(modale.locator(".dm-appl-cmd-chip")).toContainText("Rapido 30");

    await modale.locator('button[type="submit"]').click();
    await expect(page.locator("#dm-appliance-editor-modal")).toHaveCount(0);
    /* Salvato sull'apparecchio: e' li' che vive, come le altre caselle. */
    await expect
      .poll(() =>
        page.evaluate(
          () => DashboardModernModules.store.getState().sections.appliances[0].comandi || [],
        ),
      )
      .toEqual(["script.asciugatrice_rapido_30"]);

    await page.evaluate(() => {
      document.getElementById("editor-modal")?.remove();
      window.apriApplianceDetail(0);
    });
    const lista = page.locator("#details-list");
    const riga = lista.locator(
      '.dm-apde-comando-extra[data-dm-apde-entity="script.asciugatrice_rapido_30"]',
    );
    await expect(riga).toHaveCount(1, { timeout: 10000 });
    await expect(riga.locator(".dm-apde-comando-nome")).toHaveText("Rapido 30");
    await riga.locator(".dm-apde-tasto").click();
    /* E il tasto manda il servizio giusto: uno script si accende. */
    await expect
      .poll(() => page.evaluate(() => window.__comandi?.filter((c) => c.domain === "script") || []))
      .toMatchObject([
        {
          domain: "script",
          service: "turn_on",
          target: { entity_id: "script.asciugatrice_rapido_30" },
        },
      ]);
  });

  test("i comandi accanto all'apparecchio si propongono, e un tocco li aggiunge", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    /* L'apparecchio ha un'entita' comando: quello che porta il suo nome gli
     * sta accanto, e la scheda lo propone invece di farlo scrivere a mano. */
    await page.evaluate(() => {
      const stato = {
        entity_id: "switch.asciugatrice",
        state: "off",
        attributes: { friendly_name: "Asciugatrice" },
      };
      for (const registro of [_RAW_STATES, STATES]) registro[stato.entity_id] = { ...stato };
      const store = DashboardModernModules.store;
      const elenco = store.getState().sections.appliances.map((voce) => ({ ...voce }));
      elenco[0].control_entity = "switch.asciugatrice";
      store.replaceSection("appliances", elenco);
    });
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("appliances");
      window.edApplEdit(0);
    });
    const modale = page.locator("#dm-appliance-editor-modal");
    const proposte = modale.locator(".dm-appl-cmd-proposte .dm-appl-cmd-chip");
    await expect(proposte).not.toHaveCount(0);
    await modale.locator('[data-appl-cmd-sug="script.asciugatrice_rapido_30"]').click();
    await expect(modale.locator("[data-appl-comandi-scelti] .dm-appl-cmd-chip")).toHaveCount(1);
    /* Quello scelto esce dalle proposte: e' gia' in elenco. */
    await expect(
      modale.locator('.dm-appl-cmd-proposte [data-appl-cmd-sug="script.asciugatrice_rapido_30"]'),
    ).toHaveCount(0);
  });
});

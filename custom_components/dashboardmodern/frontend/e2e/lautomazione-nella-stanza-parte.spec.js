/* «Si potrebbero inserire le entità personalizzate nelle stanze tipo
 * Automazioni?» (#504).
 *
 * Qui si fa il giro intero, dalla configurazione al gesto: si scrive
 * un'automazione fra le «Entità mie» con la sua stanza, si apre quella stanza,
 * e si tocca il tasto. Due cose da guardare, e sono due difetti diversi se
 * mancano: che la riga ci arrivi — prima la stanza scelta lì non usciva da
 * quella scheda — e che il tasto la faccia PARTIRE, che è «automation.trigger»
 * e non «automation.toggle», il quale invece la disabilita.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Cucina", icon: "mdi:silverware" }],
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
  },
  visibility: { rooms: true },
};

test("un'automazione messa in una stanza si vede lì, e da lì parte", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));

  /* Un ponte che segna i servizi chiamati: è quello il verdetto. */
  await page.addInitScript(() => {
    window.__SERVIZI__ = [];
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
        if (messaggio.type === "call_service")
          window.__SERVIZI__.push(
            `${messaggio.domain}.${messaggio.service}:${messaggio.service_data?.entity_id || ""}`,
          );
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: messaggio.type === "get_states" ? [] : null,
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
  });

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["automation.luci_sera"] = {
      entity_id: "automation.luci_sera",
      state: "on",
      attributes: { friendly_name: "Automazione luci sera" },
    };
    /* È quello che scrive la scheda «Entità mie»: l'entità, il nome, l'icona e
     * la stanza — la tendina della stanza in quella scheda c'è già. */
    localStorage.setItem(
      "cd_entita_mie",
      JSON.stringify([
        {
          id: "mia-1",
          entity: "automation.luci_sera",
          nome: "Luci sera",
          icona: "🌙",
          sezione: "home",
          room_id: "r1",
        },
      ]),
    );
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);

  /* La riga c'è, col nome che le è stato dato. */
  const riga = page.locator('#page-stanze [data-dm-stanza-entita="automation.luci_sera"]').first();
  await riga.waitFor({ state: "visible", timeout: 20_000 });
  await expect(riga).toContainText("Luci sera");

  /* E ha il tasto che la fa partire, non l'interruttore che la spegnerebbe. */
  const avvia = riga.locator("[data-dm-stanza-avvia]");
  await expect(avvia).toHaveCount(1);
  await expect(riga.locator("[data-dm-stanza-tocca]")).toHaveCount(0);

  await avvia.click();

  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__), { timeout: 15_000 })
    .toContain("automation.trigger:automation.luci_sera");

  /* E il tocco è del tasto, non della riga: la pagina non si è mossa. Senza
   * questo, far partire un'automazione porterebbe altrove (#467). */
  expect(await page.evaluate(() => document.querySelector(".page.active")?.id)).toBe("page-stanze");
});

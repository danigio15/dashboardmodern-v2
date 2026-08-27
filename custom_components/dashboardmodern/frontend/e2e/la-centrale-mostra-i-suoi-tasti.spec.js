/* L'antifurto mostra i tasti che la centrale ha davvero.
 *
 * Il caso e' quello di Andrea: Ring collegato con ring-mqtt. Accetta Casa e
 * Fuori, la modalita' Notte non ce l'ha, un codice non lo pubblica. Sulla
 * plancia c'erano lo stesso tre tasti fissi: Notte chiedeva il PIN e poi non
 * faceva niente, e con la centrale in ARMATO · CASA il tasto acceso era Fuori.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.ring" },
  },
  visibility: { home: true, security: true },
};

/* La centrale, come la pubblica ring-mqtt: casa e fuori, nessun codice. */
const RING = {
  entity_id: "alarm_control_panel.ring",
  state: "armed_home",
  attributes: { friendly_name: "Ring Alarm", supported_features: 3 },
};

/* Una centrale completa, col codice per tutto: la plancia di chi il PIN ce l'ha. */
const COMPLETA = {
  entity_id: "alarm_control_panel.ring",
  state: "disarmed",
  attributes: { friendly_name: "Centrale", supported_features: 7, code_format: "number" },
};

async function boot(page, testInfo, centrale) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La centrale arriva dall'elenco che Home Assistant manda all'avvio: e' da
     li' che la plancia si popola, e scriverla dopo a mano verrebbe cancellata
     dal primo giro del runtime. */
  await page.addInitScript((centrale) => {
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
        if (message.type === "get_states") result = [centrale];
        if (message.type === "frontend/get_user_data") result = { value: null };
        globalThis.__DM_SERVICE_CALLS__ ||= [];
        if (message.type === "call_service") globalThis.__DM_SERVICE_CALLS__.push(message);
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
  }, centrale);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((id) => Boolean(eval("_RAW_STATES")[id]), centrale.entity_id);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-security")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    /* Il tasto acceso lo marca il giro di disegno storico: senza un socket vero
       non lo chiama nessuno, quindi lo si chiama qui. */
    try {
      render();
    } catch (_errore) {}
  });
  await expect(page.locator("#alarm-stage .alarm-mode-btn").first()).toBeVisible();
}

const tasti = (page) =>
  page
    .locator("#alarm-stage .alarm-mode-btn")
    .evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.mode));

/* La fila nasce con i tasti di sempre e si rifa' quando la centrale si e'
   presentata: e' quella seconda fila che si guarda. */
const aspettaTasti = async (page, attesi) => {
  await expect.poll(() => tasti(page)).toEqual(attesi);
};

test.describe("la centrale antifurto", () => {
  test("mostra solo gli inserimenti che accetta", async ({ page }, testInfo) => {
    await boot(page, testInfo, RING);
    await aspettaTasti(page, ["home", "away", "disarm"]);
  });

  test("armata in casa accende il tasto Casa, non quello Fuori", async ({ page }, testInfo) => {
    await boot(page, testInfo, RING);
    await aspettaTasti(page, ["home", "away", "disarm"]);
    await expect(page.locator('#alarm-stage .alarm-mode-btn[data-mode="home"]')).toHaveClass(
      /active/,
    );
    await expect(page.locator('#alarm-stage .alarm-mode-btn[data-mode="away"]')).not.toHaveClass(
      /active/,
    );
    await expect(page.locator("#alarm-state-text-new")).toHaveText(/CASA/);
  });

  test("senza codice pubblicato il comando parte, senza tastierino", async ({ page }, testInfo) => {
    await boot(page, testInfo, RING);
    await aspettaTasti(page, ["home", "away", "disarm"]);
    await page.locator('#alarm-stage .alarm-mode-btn[data-mode="away"]').click();
    await expect(page.locator("#custom-keypad")).not.toHaveClass(/show/);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis.__DM_SERVICE_CALLS__ || []).map((chiamata) => chiamata.service),
        ),
      )
      .toContain("alarm_arm_away");
  });

  test("chi il codice ce l'ha se lo vede ancora chiedere", async ({ page }, testInfo) => {
    await boot(page, testInfo, COMPLETA);
    await aspettaTasti(page, ["home", "away", "night", "disarm"]);
    await page.locator('#alarm-stage .alarm-mode-btn[data-mode="night"]').click();
    await expect(page.locator("#custom-keypad")).toHaveClass(/show/);
    // Niente parte finche' il codice non e' stato battuto.
    expect(await page.evaluate(() => (globalThis.__DM_SERVICE_CALLS__ || []).length)).toBe(0);
  });
});

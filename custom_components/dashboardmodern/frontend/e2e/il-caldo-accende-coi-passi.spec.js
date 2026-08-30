/* La parte Caldo del popup Clima accende coi passi, come la parte Freddo.
 *
 * Dal campo: «questa funzione la devi riproporre anche sulla parte caldo non
 * solo freddo». Il runtime storico accendeva il Caldo con `nsToggleTerm`, che
 * parla solo agli input_boolean: un termostato vero (climate.*) riceveva una
 * chiamata di un altro dominio, e il Tasto Clima rapido per-unita' li' non
 * parlava proprio. La prova ascolta il filo: toccando il termosifone spento
 * devono partire i SUOI passi — riscaldamento e la SUA temperatura — sul
 * dominio climate.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "cucina", name: "Cucina", icon: "mdi:stove" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { name: "Termosifone Cucina", entity: "climate.trv_cucina", type: "termo", room: "cucina" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

test("il tocco Caldo su un termostato vero manda i suoi passi", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__DM_CHIAMATE__ = [];
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;

      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }

      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        if (message.type === "call_service") window.__DM_CHIAMATE__.push(message);
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["climate.trv_cucina"] = {
      entity_id: "climate.trv_cucina",
      state: "off",
      attributes: {
        friendly_name: "Termosifone Cucina",
        current_temperature: 18,
        hvac_modes: ["off", "heat"],
      },
    };
    /* I passi di QUESTA unita', detti dalla sua scheda: 21 gradi. */
    localStorage.setItem(
      "cd_clima_rapido_unita",
      JSON.stringify({ "climate.trv_cucina": { mode: "heat", temperature: 21, fan: "" } }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (typeof window.apriQuickClimaCaldo === "function") window.apriQuickClimaCaldo();
    else {
      window.apriQuickClima?.();
      window.setClimaMode?.("caldo");
    }
  });
  const tasto = page.locator('#quick-clima-grid .ns-clima-btn[data-entity="climate.trv_cucina"]');
  await expect(tasto).toBeVisible({ timeout: 15000 });
  await tasto.click();
  /* Primo passo subito: riscaldamento, sul dominio climate. */
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window.__DM_CHIAMATE__ || []).map(
            (m) => `${m.domain}.${m.service}:${JSON.stringify(m.service_data)}`,
          ),
        ),
      { timeout: 8000 },
    )
    .toContain('climate.set_hvac_mode:{"entity_id":"climate.trv_cucina","hvac_mode":"heat"}');
  /* Secondo passo dopo la pausa: la SUA temperatura, non i 26 del ripiego. */
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window.__DM_CHIAMATE__ || []).map((m) => JSON.stringify(m.service_data)),
        ),
      { timeout: 8000 },
    )
    .toContain('{"entity_id":"climate.trv_cucina","temperature":21}');
  /* E nessuna chiamata al dominio degli input_boolean. */
  const domini = await page.evaluate(() => (window.__DM_CHIAMATE__ || []).map((m) => m.domain));
  expect(domini).not.toContain("input_boolean");
});

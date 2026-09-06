/* La pastiglia sulla foto dell'auto e la tendina del target, sulla pagina vera.
 *
 * «Lo stato dice off ma la vettura e' collegata. E' in carica, dice on: prima
 * usciva come stato non collegato, collegato, in ricarica.» E «il menu a
 * tendina della percentuale di ricarica evcc non funziona».
 *
 * La casella dello stato porta un `binary_sensor.charging` dalla colonnina, e
 * il guscio stampava la parola grezza. Il target era un sensore di sola
 * lettura e la tendina mandava ordini nel vuoto. Qui si guarda quello che uno
 * vede: la pastiglia che dice «Collegata» e «In carica», e la tendina che
 * manda `set_value` a un numero — o si dichiara muta davanti a un sensore.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("binary_sensor.wb_charging", "off", { friendly_name: "Wallbox Charging" }),
  stato("binary_sensor.wb_connected", "on", { friendly_name: "Wallbox Connected" }),
  stato("sensor.wb_power", "0", { friendly_name: "Wallbox Power", unit_of_measurement: "W" }),
  stato("sensor.car_soc", "37", { friendly_name: "B10 Battery", unit_of_measurement: "%" }),
  stato("number.evcc_limit_soc", "80", {
    friendly_name: "Loadpoint 1 Limit SoC",
    unit_of_measurement: "%",
    min: 0,
    max: 100,
    step: 5,
  }),
  stato("sensor.car_target", "90", { friendly_name: "B10 Target SoC", unit_of_measurement: "%" }),
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10", icon: "mdi:car-electric" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {
      "dm.ev_stato_ricarica": "binary_sensor.wb_charging",
      "dm.ev_cavo_collegato": "binary_sensor.wb_connected",
      "dm.ev_potenza_wallbox": "sensor.wb_power",
      "dm.ev_batteria_auto": "sensor.car_soc",
      "dm.ev_target_soc": "number.evcc_limit_soc",
    },
  },
  visibility: { home: true, ev: true },
};

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Un socket finto che risponde agli stati e SI RICORDA i comandi: e' il modo
   * di vedere cosa la tendina manda davvero. */
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
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    for (const voce of haStates) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.render?.();
  }, STATI);
}

/* Un cambio di stato come lo manda Home Assistant: si scrive e si ridisegna. */
async function cambia(page, entity, state) {
  await page.evaluate(
    ({ entity, state }) => {
      for (const registro of [_RAW_STATES, STATES])
        if (registro[entity]) registro[entity].state = state;
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { entity, state },
  );
}

test("la pastiglia dice collegata, in carica e non connessa — non on e off", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const pastiglia = page.locator("#lm-charge-badge #lm-stato-txt");
  /* Cavo dentro, non sta caricando: collegata. */
  await expect(pastiglia).toHaveText(/Collegata|Plugged in/, { timeout: 15_000 });
  await expect(pastiglia).not.toHaveText(/\boff\b/);

  /* Parte la carica. */
  await cambia(page, "binary_sensor.wb_charging", "on");
  await expect(pastiglia).toHaveText(/In carica|Charging/, { timeout: 15_000 });
  await expect(page.locator("#lm-charge-badge")).toHaveAttribute("data-dm-stato", "C");

  /* Cavo fuori. */
  await cambia(page, "binary_sensor.wb_charging", "off");
  await cambia(page, "binary_sensor.wb_connected", "off");
  await expect(pastiglia).toHaveText(/Non connessa|Not connected/, { timeout: 15_000 });
});

test("la tendina del target manda set_value a un numero, e mostra il suo valore", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const tendina = page.locator("#sel-target-soc");
  await expect(tendina).toHaveCount(1);
  /* L'entita' e' un numero senza `options`: le voci si fanno dai suoi min, max
   * e step, e la tendina sta sul valore vero — non su una voce a caso. */
  await expect(tendina).toHaveValue("80", { timeout: 15_000 });
  await expect(tendina).toHaveAttribute("data-dm-target", "comando");
  await expect(tendina).not.toBeDisabled();
  const voci = await tendina.locator("option").evaluateAll((nodi) => nodi.map((n) => n.value));
  expect(voci).toContain("70");
  expect(voci).toContain("80");
  /* E anche quelle che le cinque di serie del guscio non hanno: il passo e' 5. */
  expect(voci).toContain("55");
  expect(voci).toContain("75");

  await tendina.selectOption("70");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.__comandi || [])
          .filter((m) => m.service === "set_value")
          .map((m) => m.service_data),
      ),
    )
    .toEqual([{ entity_id: "number.evcc_limit_soc", value: 70 }]);
});

test("davanti a un sensore di sola lettura la tendina lo dice invece di far finta", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    const mappa = JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}");
    mappa["dm.ev_target_soc"] = "sensor.car_target";
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  const tendina = page.locator("#sel-target-soc");
  await expect(tendina).toHaveAttribute("data-dm-target", "sola-lettura", { timeout: 15_000 });
  await expect(tendina).toBeDisabled();
  /* E nessun comando parte per un sensore. */
  await page.evaluate(() => window.changeSelect?.("dm.ev_target_soc", "60"));
  const comandi = await page.evaluate(
    () => (window.__comandi || []).filter((m) => m.type === "call_service").length,
  );
  expect(comandi).toBe(0);
});

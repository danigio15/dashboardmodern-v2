/* «Se clicco sulla card si apre il popup e vedo tutte le info; da fuori invece
 * la card non le mostra, ma prima le vedevo.»
 *
 * La card della sezione e quella del popup sono la stessa funzione con lo
 * stesso modello: se dicono cose diverse, non e' il disegno — e' che una delle
 * due e' vecchia. La sezione non ridisegna una card quando la sua «firma» non
 * cambia, e la firma era un elenco scritto a mano di quello che la card
 * mostra: il nome, lo stato, i watt, l'ultimo ciclo… ma non i gradi, i giri e
 * il programma, che sono arrivati dopo. Cambiando solo quelli, la card restava
 * quella di prima per sempre — anche con un ridisegno forzato — mentre il
 * popup, che si rifa' ogni volta da zero, mostrava i valori giusti.
 *
 * Qui si guardano le due card fianco a fianco, che e' esattamente il confronto
 * che ha fatto chi l'ha segnalato.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una lavatrice presa da un'integrazione: i gradi, i giri e il programma
 * arrivano dalle entita' del dispositivo, non da caselle scritte a mano. */
const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-lavanderia", name: "Lavanderia", icon: "🧺", metadata: {} }],
    cameras: [],
    appliances: [
      {
        id: "appl-lavatrice",
        name: "Lavatrice",
        visual_type: "asset",
        visual_key: "lavatrice",
        device_type: "lavatrice",
        room_id: "room-lavanderia",
        power_entity: "sensor.lavatrice_power",
        state_entity: "sensor.lavatrice_machine_status",
        control_entity: "switch.lavatrice_avvio",
        device_id: "wm-1",
        integration: "hon",
        integration_name: "Haier hOn Revived",
        device_name: "Lavatrice",
        device_manufacturer: "Hoover",
        device_model: "HWE 49AMBS/1-S",
        device_entities: [
          "sensor.lavatrice_machine_status",
          "sensor.lavatrice_temperatura",
          "sensor.lavatrice_centrifuga",
          "sensor.lavatrice_programma",
          "sensor.lavatrice_power",
          "switch.lavatrice_avvio",
        ],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

/* La macchina e' spenta, come nella segnalazione: la fase non si disegna, ma i
 * numeri restano — dicono con che programma ripartira'. */
const PRIMA = [
  stato("sensor.lavatrice_machine_status", "off", { friendly_name: "Lavatrice Machine status" }),
  stato("sensor.lavatrice_temperatura", "30", {
    friendly_name: "Lavatrice Temperatura",
    unit_of_measurement: "°C",
  }),
  stato("sensor.lavatrice_centrifuga", "800", {
    friendly_name: "Lavatrice Centrifuga",
    unit_of_measurement: "rpm",
  }),
  stato("sensor.lavatrice_programma", "Care 14", { friendly_name: "Lavatrice Programma" }),
  stato("sensor.lavatrice_power", "0", {
    friendly_name: "Lavatrice Power",
    unit_of_measurement: "W",
    device_class: "power",
  }),
  stato("switch.lavatrice_avvio", "off", { friendly_name: "Lavatrice Avvio" }),
];

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class PonteFinto {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: messaggio.id, type: "result", success: true, risultato }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

/* Gli stati entrano e la sezione si ridisegna, come quando arriva un
 * aggiornamento da Home Assistant. */
async function pubblica(page, stati) {
  await page.evaluate((elenco) => {
    /* Il registro del runtime, non una copia: dentro la plancia i due nomi
     * sono variabili del suo modulo, non proprieta' di `window`. */
    const registro = eval("_RAW_STATES");
    const vivi = eval("typeof STATES !== 'undefined' ? STATES : null");
    for (const voce of elenco) {
      registro[voce.entity_id] = voce;
      if (vivi) vivi[voce.entity_id] = voce;
    }
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-appliances-main")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, stati);
}

/* Quello che la card dice, in ordine: la fase se c'e', poi i numeri. */
const paroleDellaCard = (locator) =>
  locator.evaluate((nodo) =>
    [...nodo.querySelectorAll(".dm-ap-phase,.dm-ap-fact")].map((voce) => {
      /* Il glifo davanti e' decorazione: qui contano le parole. */
      const copia = voce.cloneNode(true);
      copia.querySelector("i")?.remove();
      return copia.textContent.replaceAll(/\s+/g, " ").trim();
    }),
  );

test("la card della sezione dice quello che dice la stessa card nel popup", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await pubblica(page, PRIMA);

  const card = page.locator('#page-appliances-main [data-appliance-id="appl-lavatrice"]');
  await expect(card).toBeVisible();
  /* Una sola scheda per apparecchio: due copie della stessa card, una vecchia
   * e una nuova, sarebbero l'altra spiegazione di quello che si vedeva. */
  await expect(page.locator('[data-appliance-id="appl-lavatrice"]')).toHaveCount(1);
  expect(await paroleDellaCard(card)).toEqual(["30 °C", "800 rpm", "Care 14"]);

  /* Adesso cambia solo il programma: gradi, giri e nome del ciclo. Lo stato
   * della macchina, i watt e l'ultimo ciclo restano identici — ed e' proprio
   * questo il caso che la firma scritta a mano non vedeva. */
  await pubblica(page, [
    stato("sensor.lavatrice_temperatura", "60", {
      friendly_name: "Lavatrice Temperatura",
      unit_of_measurement: "°C",
    }),
    stato("sensor.lavatrice_centrifuga", "1200", {
      friendly_name: "Lavatrice Centrifuga",
      unit_of_measurement: "rpm",
    }),
    stato("sensor.lavatrice_programma", "Cotone", { friendly_name: "Lavatrice Programma" }),
  ]);

  await expect.poll(() => paroleDellaCard(card)).toEqual(["60 °C", "1200 rpm", "Cotone"]);

  /* E la card del popup — la stessa funzione, lo stesso modello — deve dire la
   * stessa cosa, parola per parola. */
  await card.click();
  const dentro = page.locator("#details-list .dm-apde-vetrina .dm-ap-card");
  await expect(dentro).toBeVisible();
  expect(await paroleDellaCard(dentro)).toEqual(await paroleDellaCard(card));
});

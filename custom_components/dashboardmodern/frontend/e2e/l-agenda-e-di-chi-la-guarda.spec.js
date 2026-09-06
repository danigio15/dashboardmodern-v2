/* «Il calendario mostrato vari in base alla persona che lo sta
 * visualizzando» (#344).
 *
 *     «Utente 1 visualizza calendar.utente1, Utente 2 visualizza
 *      calendar.utente2, con la possibilità di scegliere quale calendario
 *      verrà mostrato ad ogni utente.»
 *
 * Dentro il pannello di Home Assistant chi è collegato lo sa il documento
 * ospite, non quello della plancia: `hass.user` vive di là. Finché l'ospite
 * non lo consegna, la plancia lo chiede — una riga sola in cima all'agenda — e
 * scrive la risposta nel profilo di Home Assistant di CHI E' COLLEGATO, non su
 * questo dispositivo.
 *
 * Qui si guarda quello che uno vede: l'agenda di casa finché nessuno dice chi
 * è, e l'agenda di Mario appena lo dice.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const STATI = [
  stato("person.mario", "home", { friendly_name: "Mario", user_id: "u-mario" }),
  stato("person.anna", "not_home", { friendly_name: "Anna", user_id: "u-anna" }),
  stato("calendar.famiglia", "off", { friendly_name: "Famiglia" }),
  stato("calendar.mario", "off", { friendly_name: "Mario" }),
];

/* Due calendari: quello di casa, e quello di Mario. */
const CALENDARI = [
  { id: "cal-casa", entity: "calendar.famiglia", name: "Famiglia" },
  { id: "cal-mario", entity: "calendar.mario", name: "Mario", persone: ["u-mario"] },
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
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, calendario: true },
};

/* Gli eventi come li restituisce `calendar.get_events`: uno per calendario,
 * con un titolo che si riconosce a colpo d'occhio. */
function eventiDi(entity) {
  const domani = new Date(Date.now() + 26 * 3600000);
  const fine = new Date(domani.getTime() + 3600000);
  const titolo = entity === "calendar.mario" ? "Dentista di Mario" : "Cena di famiglia";
  return {
    response: {
      [entity]: {
        events: [{ start: domani.toISOString(), end: fine.toISOString(), summary: titolo }],
      },
    },
  };
}

async function boot(page, testInfo, profilo = null) {
  test.setTimeout(120_000);
  /* Il profilo di Home Assistant di chi apre la plancia, com'e' PRIMA che la
   * plancia parta: e' cosi' che si arriva da un altro schermo, con la scelta
   * gia' fatta un'altra volta. */
  if (profilo) await page.addInitScript(`window.__profilo = ${JSON.stringify(profilo)}`);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La porta HTTP dei calendari non risponde nella prova: il filo ricade sul
   * servizio, che e' la strada che questo ponte finto conosce. */
  await page.route("**/api/calendars/**", (route) => route.fulfill({ status: 404, body: "" }));
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
        else if (messaggio.type === "frontend/get_user_data") {
          /* Il profilo dell'utente collegato: la plancia ci scrive chi guarda,
           * e da li' se lo rilegge. */
          risultato = { value: window.__profilo?.[messaggio.key] ?? null };
        } else if (messaggio.type === "frontend/set_user_data") {
          (window.__profilo ||= {})[messaggio.key] = messaggio.value;
          (window.__scritture ||= []).push(messaggio);
          risultato = {};
        } else if (messaggio.type === "call_service") {
          (window.__comandi ||= []).push(messaggio);
          const entity = messaggio.target?.entity_id;
          if (messaggio.domain === "calendar" && messaggio.service === "get_events")
            risultato = window.__eventiDi?.(entity) ?? null;
          else risultato = {};
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
  await page.addInitScript(`window.__eventiDi = ${eventiDi.toString()}`);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ haStates, calendari }) => {
      for (const voce of haStates) {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }
      localStorage.setItem("cd_calendari", JSON.stringify(calendari));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { haStates: STATI, calendari: CALENDARI },
  );
  /* Si apre la pagina dell'agenda dalla sua voce nella barra. */
  await page.locator('.tab[data-tab="calendario"]').click();
  await expect(page.locator("#page-calendario")).toHaveClass(/active/);
}

test.describe("l'agenda è di chi la guarda (#344)", () => {
  test("senza sapere chi guarda si vede la casa; detto chi è, si vede la sua", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    const pagina = page.locator("#page-calendario");
    /* La riga chiede chi guarda, coi nomi di casa e la via di mezzo. */
    const riga = pagina.locator(".dm-calp-chi");
    await expect(riga).toHaveCount(1);
    await expect(riga.locator('[data-dm-calp-chi="u-mario"]')).toHaveText("Mario");
    await expect(riga.locator('[data-dm-calp-chi="u-anna"]')).toHaveText("Anna");
    await expect(riga.locator('[data-dm-calp-chi="tutti"]')).toHaveCount(1);

    /* Finché non lo dice nessuno: l'agenda è quella di casa. */
    await expect(pagina).toContainText("Cena di famiglia", { timeout: 15000 });
    await expect(pagina).not.toContainText("Dentista di Mario");

    /* «Sono io»: da qui in poi l'agenda è la sua, con la casa dentro. */
    await riga.locator('[data-dm-calp-chi="u-mario"]').click();
    await expect(pagina).toContainText("Dentista di Mario", { timeout: 15000 });
    await expect(pagina).toContainText("Cena di famiglia");
    await expect(riga.locator('[data-dm-calp-chi="u-mario"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    /* E la scelta è finita nel profilo di chi è collegato, non in una casella
     * di questo dispositivo: da un altro schermo la persona si ritrova la sua
     * agenda, e non la vede nessun altro. */
    await expect
      .poll(() => page.evaluate(() => window.__scritture?.map((m) => [m.key, m.value]) || []))
      .toEqual([["dashboardmodern_calendario_utente", { utente: "u-mario" }]]);
  });

  test("da un altro schermo la persona si ritrova la sua agenda, senza ridirlo", async ({
    page,
  }, testInfo) => {
    /* La scelta vive nel profilo di Home Assistant, non in una casella di
     * questo dispositivo: aprendo la plancia altrove è già lì. */
    await boot(page, testInfo, { dashboardmodern_calendario_utente: { utente: "u-mario" } });
    const pagina = page.locator("#page-calendario");
    await expect(pagina).toContainText("Dentista di Mario", { timeout: 15000 });
    await expect(pagina).toContainText("Cena di famiglia");
    await expect(pagina.locator('[data-dm-calp-chi="u-mario"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    /* E non si è riscritto niente: la scelta era già la sua. */
    await expect.poll(() => page.evaluate(() => window.__scritture?.length || 0)).toBe(0);
  });

  test("dalla scheda Agenda si dice di chi è un calendario", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => window.apriConfigEntita());
    /* La linguetta «Agenda» la aggiunge il modulo accanto a quelle del guscio:
     * ci si arriva col dito, come chiunque. */
    await page.locator('.ed-tab[data-tab="agenda"]').click();
    const riga = page.locator('#ed-body [data-cal-index="0"]');
    await riga.locator("[data-cal-edit]").click();
    const persone = riga.locator("[data-cal-persone]");
    await expect(persone).toHaveCount(1);
    /* I nomi sono quelli delle persone di casa, e nessuno è spuntato: il
     * calendario di famiglia è di tutti. */
    await expect(persone.locator('[data-cal-persona="u-mario"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await persone.locator('[data-cal-persona="u-anna"]').click();
    /* Si salva col tasto in fondo alla scheda, che e' quello che si preme:
     * i salvataggi di riga stanno dietro di lui da quando l'editor ha un
     * salvataggio solo per scheda. */
    await page.locator("#ed-body [data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("cd_calendari") || "[]")[0]?.persone),
      )
      .toEqual(["u-anna"]);
  });
});

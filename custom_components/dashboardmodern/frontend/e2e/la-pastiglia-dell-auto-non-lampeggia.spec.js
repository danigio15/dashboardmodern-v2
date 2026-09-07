/* La pastiglia dell'auto non lampeggia «off».
 *
 * Dal telefono, filmato: la pastiglia sull'eroe dice «Non in carica», e sette
 * volte in nove secondi — a ogni notizia della casa — lampeggia per uno o due
 * fotogrammi la parola grezza «off», col pallino verde. Otto millisecondi a
 * 120 Hz: si vede eccome, ed e' il difetto che il modulo della pastiglia
 * doveva togliere.
 *
 * Il guscio scrive `statiEV[codeEV] || codeEV`: per un `binary_sensor.charging`
 * a `off` non c'e' nessuna voce, quindi stampa «off» e il pallino cade sul ramo
 * finale, che e' verde. Il modulo traduce in lettera e riscrive — ma un
 * fotogramma dopo, e quel fotogramma il telefono lo dipinge.
 *
 * Qui non si guarda il DOM: si guarda quello che viene DIPINTO. Un giro di
 * `requestAnimationFrame` legge la pastiglia una volta per fotogramma, che e'
 * l'ultimo istante prima che il browser disegni: quello che c'e' scritto li'
 * e' esattamente quello che l'occhio vede.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: [{ id: "ev1", name: "B10", brand: "leapmotor", battery_entity: "sensor.soc" }],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    /* Com'e' configurata la plancia della segnalazione: lo stato della ricarica
     * e' un `binary_sensor`, e del cavo non c'e' nessun sensore. */
    entityOverrides: {
      "dm.ev_batteria_auto": "sensor.soc",
      "dm.ev_stato_ricarica": "binary_sensor.charging",
    },
  },
  visibility: { home: true, energy: true, ev: true },
};

const STATI = [
  { entity_id: "sensor.soc", state: "62", attributes: { unit_of_measurement: "%" } },
  { entity_id: "binary_sensor.charging", state: "off", attributes: {} },
];

test("la pastiglia non mostra mai la parola grezza, nemmeno per un fotogramma", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((stati) => {
    const raw = eval("_RAW_STATES");
    for (const voce of stati) raw[voce.entity_id] = voce;
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATI);

  await expect
    .poll(() => page.evaluate(() => document.getElementById("lm-stato-txt")?.textContent ?? null), {
      timeout: 20_000,
    })
    .not.toBeNull();

  /* La casa parla, e il guscio risponde con `cdRenderSoon`: un disegno per
   * fotogramma, chiesto DENTRO un `requestAnimationFrame`. E' quella la strada
   * su cui il fotogramma sbagliato si vede — chi si mette in coda per il
   * fotogramma da dentro il fotogramma arriva a quello dopo — ed e' la strada
   * vera del guscio, non un evento inventato dalla prova. */
  const visti = await page.evaluate(async () => {
    const letti = new Set();
    let acceso = true;
    const guarda = () => {
      if (!acceso) return;
      const testo = document.getElementById("lm-stato-txt")?.textContent;
      if (testo) letti.add(testo.trim());
      requestAnimationFrame(guarda);
    };
    requestAnimationFrame(guarda);
    for (let giro = 0; giro < 12; giro += 1) {
      window.cdRenderSoon?.();
      await new Promise((ok) => setTimeout(ok, 120));
    }
    await new Promise((ok) => setTimeout(ok, 300));
    acceso = false;
    return [...letti];
  });

  expect(visti, `la pastiglia ha mostrato: ${visti.map((v) => `«${v}»`).join(", ")}`).not.toContain(
    "off",
  );
  /* E quello che mostra e' la parola tradotta: un `off` senza cavo dichiarato
   * e senza potenza e' «non in carica», non «off» e non «—». */
  expect(visti).toContain("Non in carica");
});

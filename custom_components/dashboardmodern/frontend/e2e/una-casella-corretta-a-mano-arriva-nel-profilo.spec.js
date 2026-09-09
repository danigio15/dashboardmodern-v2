/* «Ho modificato a mano l'entità e salvato. Purtroppo a schermo compaiono
 *  ancora i km residui dell'AdBlue ma se clicco sopra prende il grafico
 *  corretto dei km residui del carburante» (#444).
 *
 * Le caselle di una vettura vivono in due posti, e per disegno: nel profilo,
 * che è il loro padrone, e nella mappa di casa, che è quella che il guscio
 * legge con `resolveEntity`. Correggerne una scriveva solo la seconda, e i due
 * posti si contraddicevano sullo stesso schermo.
 *
 * Qui si fa il gesto vero, sulla plancia accesa: si scrive l'entità giusta
 * nella casella e la si lascia — il momento in cui la plancia dice «Salvato»,
 * senza nessun bottone da premere. Poi si guarda dove è finita.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ADBLUE = "sensor.kodiaq_adblue_range";
const GASOLIO = "sensor.kodiaq_range";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    /* La Kodiaq come la lascia il collegamento all'integrazione: l'autonomia
     * indovinata è quella dell'AdBlue, non quella del gasolio. */
    ev: [
      {
        uid: "auto1",
        name: "Kodiaq",
        tipo: "termica",
        ov: { "dm.ev_autonomia": ADBLUE, "dm.ev_carburante": "sensor.kodiaq_fuel_level" },
      },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.ev_autonomia": ADBLUE, "dm.ev_carburante": "sensor.kodiaq_fuel_level" },
  },
  visibility: { home: true, ev: true },
};

const casella = (page) =>
  page.locator('#ed-body input.ed-slot-in[data-ref="dm.ev_autonomia"]').first();

const nelProfilo = (page, ref) =>
  page.evaluate((quale) => {
    try {
      const auto = JSON.parse(window.localStorage.getItem("cd_ev_cars") || "[]");
      return auto?.[0]?.ov?.[quale] || "";
    } catch (_errore) {
      return "";
    }
  }, ref);

const nellaCasa = (page, ref) =>
  page.evaluate(
    (quale) => JSON.parse(window.localStorage.getItem("cd_entity_overrides") || "{}")[quale] || "",
    ref,
  );

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => window.localStorage.setItem("cd_ev_car_active", "auto1"));
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("sez2"));
}

test("correggere la casella la porta anche nel profilo dell'auto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await expect(casella(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(casella(page)).toHaveValue(ADBLUE);
  expect(await nelProfilo(page, "dm.ev_autonomia")).toBe(ADBLUE);

  /* Il gesto. Il valore si scrive e l'evento si manda come lo manda il campo —
   * `onchange="edSetSlot(this)"` — perché la casella grezza sta dietro il
   * selettore «Scegli entità», che è quello che scrive lì dentro anche quando
   * a premere è una persona. */
  await casella(page).evaluate((campo, valore) => {
    campo.value = valore;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }, GASOLIO);

  /* La mappa di casa la prende: è quella da cui passa il grafico, e diceva già
   * la cosa giusta anche prima. */
  await expect.poll(() => nellaCasa(page, "dm.ev_autonomia"), { timeout: 10_000 }).toBe(GASOLIO);
  /* E adesso la prende anche il profilo, che è dove la card e la tessera
   * leggono: è il pezzo che mancava. */
  await expect.poll(() => nelProfilo(page, "dm.ev_autonomia"), { timeout: 10_000 }).toBe(GASOLIO);
  /* Le altre caselle restano dove sono: si stava correggendo una. */
  expect(await nelProfilo(page, "dm.ev_carburante")).toBe("sensor.kodiaq_fuel_level");
});

test("la correzione si ferma dopo un giro, non si rimbalza", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await expect(casella(page)).toHaveCount(1, { timeout: 20_000 });

  /* Salvare il profilo fa riscrivere i campi, e i campi tornano da `edSetSlot`:
   * prendendole tutte, i due lati si rimbalzavano il numero all'infinito e la
   * pagina si piantava. Si conta quante volte `edSetSlot` viene chiamato dopo
   * un solo gesto: deve essere un numero piccolo e fermo. */
  await page.evaluate(() => {
    window.__dmConta = 0;
    const prima = window.edSetSlot;
    window.edSetSlot = function (...args) {
      window.__dmConta += 1;
      return prima.apply(this, args);
    };
  });
  await casella(page).evaluate((campo, valore) => {
    campo.value = valore;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }, GASOLIO);
  await expect.poll(() => nelProfilo(page, "dm.ev_autonomia"), { timeout: 10_000 }).toBe(GASOLIO);

  const dopoIlGesto = await page.evaluate(() => window.__dmConta);
  await page.waitForTimeout(1500);
  const dopoLAttesa = await page.evaluate(() => window.__dmConta);
  expect(dopoIlGesto).toBeLessThan(5);
  /* E soprattutto: fermo. Un anello continuerebbe a girare da solo. */
  expect(dopoLAttesa).toBe(dopoIlGesto);
});

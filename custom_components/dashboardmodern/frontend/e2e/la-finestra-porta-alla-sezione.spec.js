/* «Apri sezione» porta davvero alla sezione, e non compare dove non porta.
 *
 * La finestra di una tessera dice cosa sta succedendo; quando non basta si va
 * nella sezione, che e' il posto dove quella roba si comanda per intero. Prima
 * da li' si usciva solo chiudendo e andando a cercare la voce in basso.
 *
 * Le due meta' della prova sono ugualmente importanti. La prima: il tasto
 * porta dove dice. La seconda: dove non c'e' una sezione da aprire il tasto
 * non c'e' proprio — batterie, allagamenti e cose da fare vivono soltanto in
 * Home, e un tasto che non porta da nessuna parte e' una promessa che nessuno
 * mantiene.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Salotto", order: 0, temp: "sensor.salotto_temperatura" },
      { name: "Cucina", order: 1, temp: "sensor.cucina_temperatura" },
    ],
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
  visibility: {},
};

async function apriTessera(page, chiave) {
  const tessera = page.locator(`#dm-widgets [data-dm-widget="${chiave}"]`).first();
  await tessera.waitFor({ state: "visible", timeout: 20_000 });
  await tessera.click();
  await expect(page.locator(`#dm-widget-popup [data-dm-widget-detail="${chiave}"]`)).toBeVisible();
}

test("dalla finestra delle Temperature si arriva alla pagina Temperature", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    for (const [entity, gradi] of [
      ["sensor.salotto_temperatura", "21.4"],
      ["sensor.cucina_temperatura", "22.1"],
    ]) {
      grezzi[entity] = {
        entity_id: entity,
        state: gradi,
        attributes: { unit_of_measurement: "°C", device_class: "temperature" },
      };
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await apriTessera(page, "temperatura");
  const vai = page.locator("#dm-widget-popup [data-dm-w-sezione]");
  await expect(vai).toBeVisible();
  await vai.click();

  /* La finestra si chiude e la pagina cambia davvero: sono due cose, e la
   * prova le chiede tutt'e due — un tasto che chiude e basta sarebbe passato
   * per buono controllando solo la prima. */
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          aperta: !document.getElementById("dm-widget-popup")?.hidden,
          pagina: document.querySelector(".page.active")?.id || "",
        })),
      { timeout: 15_000 },
    )
    .toEqual({ aperta: false, pagina: "page-temp" });
});

test("una sezione spenta in configurazione non offre il tasto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["sensor.salotto_temperatura"] = {
      entity_id: "sensor.salotto_temperatura",
      state: "21.4",
      attributes: { unit_of_measurement: "°C", device_class: "temperature" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  /* Chi spegne una sezione in configurazione se ne ritrova la voce nascosta:
   * `cdApplyNavVis` le scrive `display:none` addosso. Portarci sarebbe peggio
   * che non offrirlo — si aprirebbe una pagina che l'utente ha deciso di non
   * avere — quindi il tasto non deve nemmeno comparire.
   *
   * La si spegne come la spegne l'utente, non nascondendo la voce a mano: quel
   * giro gira ogni tre secondi e a una sezione accesa il `display` glielo
   * TOGLIE, quindi una voce nascosta di nascosto tornerebbe visibile da sola —
   * e la prova passerebbe o cadrebbe a seconda di quanto e' stata veloce. */
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    sezioni.temp = false;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    window.cdApplyNavVis?.();
  });
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.tab[data-tab="temp"]')).display === "none",
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  await apriTessera(page, "temperatura");
  await expect(page.locator("#dm-widget-popup [data-dm-w-sezione]")).toHaveCount(0);
});

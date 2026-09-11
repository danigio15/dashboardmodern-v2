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

/* «Il tasto "Apri sezione" del widget porte apre ancora la sezione Sicurezza
 * invece che la sua nuova» (#501).
 *
 * Le porte e i cancelli sono usciti dalla Sicurezza con la #275: hanno la loro
 * pagina e la loro voce nella barra. La tavola che dice a quale sezione porta
 * ogni tessera era rimasta indietro, e il tasto portava in una pagina dove
 * quelle porte non ci sono piu'.
 */
test("dalla finestra delle Porte si arriva ad «Apri porte», non alla Sicurezza", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["lock.portone"] = {
      entity_id: "lock.portone",
      state: "locked",
      attributes: { friendly_name: "Portone" },
    };
    /* Le aperture le scrive il loro editor nella loro chiave: e' l'unica cosa
     * che fa nascere la tessera e la pagina. */
    localStorage.setItem(
      "cd_security_doors",
      JSON.stringify([{ id: "d1", name: "Portone", entity: "lock.portone", icon: "🚪" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await apriTessera(page, "porte");
  const vai = page.locator("#dm-widget-popup [data-dm-w-sezione]");
  await expect(vai).toBeVisible({ timeout: 15_000 });
  /* Il tasto dichiara la tessera, non la sezione: e' la tavola a tradurla, ed
   * e' la tavola che era rimasta indietro. */
  await expect(vai).toHaveAttribute("data-dm-w-sezione", "porte");

  /* Quanti tasti ci sono dopo un giro di stati.
   *
   * Il piede si rifa' quando la Home si ridisegna, e la Home si ridisegna a
   * ogni giro di stati — in una casa viva, ogni paio di secondi. Qui gli stati
   * non si muovono da soli: il giro glielo si da' noi, che e' esattamente
   * quello che succede a chi la plancia ce l'ha davanti. */
  const tastiDopoUnGiro = async () => {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
    );
    return page.evaluate(
      () => document.querySelectorAll("#dm-widget-popup [data-dm-w-sezione]").length,
    );
  };

  /* E il tasto segue la sezione MENTRE la finestra e' aperta.
   *
   * Il piede si disegnava una volta sola, all'apertura: la voce di una sezione
   * la crea il suo modulo, e su un telefono — dove la plancia parte piu'
   * adagio — nasceva dopo il tocco. Il tasto non c'era, e non compariva piu'
   * finche' non si chiudeva e si riapriva la finestra. Qui si prova la stessa
   * cosa al contrario, che e' piu' facile da fare succedere: si spegne la
   * sezione a finestra aperta, e il tasto se ne deve andare invece di restare
   * li' a promettere una pagina che non c'e' piu'. */
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    sezioni.porte = false;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    window.cdApplyNavVis?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect.poll(tastiDopoUnGiro, { timeout: 20_000 }).toBe(0);

  /* E riaccesa torna, a finestra ancora aperta: e' questa la meta' che manca a
   * chi apre la tessera prima che la voce sia nata — il tasto non compariva
   * piu' finche' non si chiudeva e si riapriva la finestra.
   *
   * Si aspetta prima che la voce torni davvero visibile: chi la rimette in
   * piedi e' la sezione delle aperture, sul suo giro, e il tasto la segue —
   * non la precede. */
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    delete sezioni.porte;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    window.cdApplyNavVis?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect.poll(tastiDopoUnGiro, { timeout: 20_000 }).toBe(1);
  await expect(vai).toBeVisible({ timeout: 20_000 });
  await vai.click();

  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          aperta: !document.getElementById("dm-widget-popup")?.hidden,
          pagina: document.querySelector(".page.active")?.id || "",
        })),
      { timeout: 15_000 },
    )
    .toEqual({ aperta: false, pagina: "page-porte" });
});

/* La cornice dell'auto tiene una forma sola, cavo o non cavo.
 *
 * Le foto di un'auto sono due — cavo staccato e cavo attaccato — e quasi mai
 * hanno la stessa proporzione: ritagliate in momenti diversi, magari prese da
 * due siti. La cornice si misurava sulla foto a schermo, quindi cambiava
 * forma da sola quando si attaccava il cavo: la stessa macchina si vedeva in
 * due modi, e attaccare la spina faceva saltare mezza pagina.
 *
 * La forma adesso la detta sempre la foto a riposo, che e' quella che c'e'
 * sempre; se serve la si carica di lato solo per farsi misurare.
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
    /* La casella del cavo sta nel SEME, non scritta di lato.
     *
     * Prima la prova la infilava in `cd_entity_overrides` a plancia gia'
     * avviata: funziona finche' il giro che allinea la configurazione e' gia'
     * passato, e su una macchina carica quel giro arriva dopo e riscrive la
     * mappa con quella del seme — dove la casella non c'era. Da li' in poi la
     * sezione non poteva sapere che il cavo era attaccato: restava
     * «unplugged», la foto restava quella a riposo, e la prova cadeva su una
     * cosa che non le era mai stata detta davvero. Nel seme la casella c'e'
     * dall'inizio, e nessun giro la puo' togliere. */
    entityOverrides: { "dm.ev_cavo_collegato": "binary_sensor.cavo_auto" },
  },
  visibility: { ev: true },
};

/* Due foto di proporzioni diverse, servite dalla prova: 2:1 e 1:1. */
function pngDiMisura(larghezza, altezza) {
  return {
    status: 200,
    contentType: "image/svg+xml",
    body:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezza}" height="${altezza}" ` +
      `viewBox="0 0 ${larghezza} ${altezza}"><rect width="100%" height="100%" fill="#2563eb"/></svg>`,
  };
}

test("attaccare il cavo non cambia la forma della cornice", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/local/auto-riposo.svg", (route) => route.fulfill(pngDiMisura(800, 400)));
  await page.route("**/local/auto-carica.svg", (route) => route.fulfill(pngDiMisura(600, 600)));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => Boolean(window.cdEvCaptureProfile?.__dmEvSection), null, {
    timeout: 20000,
  });
  /* Chi registra la casella canonica deve esserci davvero.
   *
   * Si chiamava col punto interrogativo, e su una macchina carica quella
   * funzione ogni tanto non c'era ancora: la chiamata scivolava via senza dire
   * niente, la casella «cavo collegato» non veniva mai registrata, e da li' in
   * poi la sezione non poteva sapere che il cavo era attaccato — restava la
   * foto a riposo, e la prova cadeva quindici secondi dopo su una cosa che non
   * era mai stata chiesta. */
  await page.waitForFunction(() => typeof window.cdApplyCanonicalOverrides === "function", null, {
    timeout: 20000,
  });

  const forma = async (attaccato) => {
    await page.evaluate((plugged) => {
      localStorage.setItem("cd_ev_image", JSON.stringify("/local/auto-riposo.svg"));
      localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/auto-carica.svg"));
      localStorage.setItem(
        "cd_entity_overrides",
        JSON.stringify({ "dm.ev_cavo_collegato": "binary_sensor.cavo_auto" }),
      );
      window.cdApplyCanonicalOverrides({ "dm.ev_cavo_collegato": "binary_sensor.cavo_auto" });
      const stati = eval("_RAW_STATES");
      stati["binary_sensor.cavo_auto"] = {
        entity_id: "binary_sensor.cavo_auto",
        state: plugged ? "on" : "off",
        attributes: {},
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      /* E il cambio va detto come lo dice Home Assistant.
       *
       * La sezione dell'auto si risveglia su «state-changed», e solo se
       * l'entita' cambiata e' una delle sue: «states-ready» da solo la
       * lasciava dormire, e il disegno tornava buono soltanto quando passava
       * di li' un giro di ridisegno del guscio — cosa che su una macchina
       * scarica succede subito e su una carica puo' non succedere affatto. La
       * prova cadeva li', su un risveglio che non aveva mai chiesto. */
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "binary_sensor.cavo_auto" },
        }),
      );
    }, attaccato);
    /* Non un'attesa a tempo: la sezione si ridisegna quando le pare, e su una
     * macchina carica novecento millesimi non bastano — la prova cadeva li'.
     *
     * E non basta aspettare la foto: la forma arriva DOPO, quando la foto ha
     * finito di caricarsi e la sezione si ridisegna. Chi leggeva subito dopo
     * il cambio di indirizzo trovava la casella ancora vuota — non un difetto
     * della cornice, una domanda fatta troppo presto. Si aspettano tutt'e due
     * le cose che devono succedere: la foto giusta a schermo e una forma
     * scritta sulla cornice. */
    const attesa = attaccato ? "auto-carica" : "auto-riposo";
    const leggi = (chiave) =>
      page.evaluate(
        (quale) =>
          quale === "foto"
            ? document.getElementById("ev-mod-car-img")?.getAttribute("src") || ""
            : document
                .getElementById("lm-hero-card")
                ?.style.getPropertyValue("--dm-evv-hero-ratio") || "",
        chiave,
      );
    await expect.poll(() => leggi("foto"), { timeout: 15_000 }).toContain(attesa);
    await expect.poll(() => leggi("forma"), { timeout: 15_000 }).not.toBe("");
    return page.evaluate(() => ({
      forma: document.getElementById("lm-hero-card")?.style.getPropertyValue("--dm-evv-hero-ratio"),
      foto: document.getElementById("ev-mod-car-img")?.getAttribute("src"),
    }));
  };

  const staccato = await forma(false);
  const attaccato = await forma(true);
  // Prima di tutto: le due foto devono essere davvero due.
  expect(staccato.foto).toContain("auto-riposo");
  expect(attaccato.foto).toContain("auto-carica");
  expect(staccato.forma, "la cornice non ha preso nessuna forma").toBeTruthy();
  expect(attaccato.forma, "la forma cambia quando si attacca il cavo").toBe(staccato.forma);
});

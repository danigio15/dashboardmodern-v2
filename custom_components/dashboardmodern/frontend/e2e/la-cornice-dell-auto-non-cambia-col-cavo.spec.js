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
    entityOverrides: {},
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

  const forma = async (attaccato) => {
    await page.evaluate((plugged) => {
      localStorage.setItem("cd_ev_image", JSON.stringify("/local/auto-riposo.svg"));
      localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/auto-carica.svg"));
      localStorage.setItem(
        "cd_entity_overrides",
        JSON.stringify({ "dm.ev_cavo_collegato": "binary_sensor.cavo_auto" }),
      );
      window.cdApplyCanonicalOverrides?.({ "dm.ev_cavo_collegato": "binary_sensor.cavo_auto" });
      const stati = eval("_RAW_STATES");
      stati["binary_sensor.cavo_auto"] = {
        entity_id: "binary_sensor.cavo_auto",
        state: plugged ? "on" : "off",
        attributes: {},
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, attaccato);
    /* Non un'attesa a tempo: la sezione si ridisegna quando le pare, e su una
     * macchina carica novecento millesimi non bastano — la prova cadeva li'.
     * Si aspetta la cosa che deve succedere, cioe' la foto giusta a schermo. */
    const attesa = attaccato ? "auto-carica" : "auto-riposo";
    await expect
      .poll(
        () => page.evaluate(() => document.getElementById("ev-mod-car-img")?.getAttribute("src")),
        { timeout: 15_000 },
      )
      .toContain(attesa);
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

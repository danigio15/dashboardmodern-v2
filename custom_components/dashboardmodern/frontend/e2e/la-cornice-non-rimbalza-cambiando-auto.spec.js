/* «Cambio vettura con il tab e le foto rimbalzano.»
 *
 * Non rimbalzava la foto: rimbalzava la CORNICE. La vetrina prende la sua
 * forma dalla proporzione della foto a riposo, e quella proporzione la
 * imparava solo guardando l'immagine a schermo — cioe' quando aveva finito di
 * caricarsi. Nel frattempo la macchina nuova stava dentro la cornice della
 * vecchia, e mezzo secondo dopo la cornice saltava: due passi invece di uno.
 * Misurato: la foto arrivava a 335 ms in una cornice alta 358, e a 762 ms la
 * cornice diventava 440.
 *
 * Adesso ogni foto si porta dietro la sua forma, e chi la monta dice quando
 * cambia. Qui si guarda fotogramma per fotogramma: non deve mai esistere un
 * momento in cui a schermo c'e' la macchina nuova dentro la cornice della
 * vecchia.
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
  visibility: { home: true, ev: true },
};

/* Due auto con foto di proporzioni diverse: e' il caso vero — le foto le
 * ritaglia chi le trova, e quasi mai vengono uguali. Con due foto della stessa
 * forma il difetto non si vede, ed e' il motivo per cui era passato. */
const DUE_AUTO = [
  {
    name: "B10",
    uid: "b10",
    ov: { "dm.ev_batteria_auto": "sensor.b10_battery" },
    img: "/local/ev/b10-idle.png",
  },
  {
    name: "T03",
    uid: "t03",
    ov: { "dm.ev_batteria_auto": "sensor.t03_battery" },
    img: "/local/ev/t03-idle.png",
  },
];

const nome = (src) =>
  String(src || "")
    .split("/")
    .pop() || "";

async function avvia(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Le foto arrivano da Home Assistant, non dalla memoria: ci mettono. E' in
   * quell'attesa che la cornice sbagliata si vedeva. */
  await page.route("**/local/**", async (route) => {
    await new Promise((fatto) => setTimeout(fatto, 200));
    const [larga, alta] = route.request().url().includes("t03") ? [400, 400] : [640, 200];
    /* La risposta puo' arrivare a pagina gia' chiusa — l'attesa qui sopra e'
     * fatta apposta perche' arrivi tardi — e servire una richiesta che non ha
     * piu' nessuno si porta dietro il browser della prova dopo. */
    try {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${larga}" height="${alta}"><rect width="${larga}" height="${alta}" fill="#888"/></svg>`,
      });
    } catch (_chiusa) {}
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 40_000,
  });
  await page.evaluate((elenco) => {
    localStorage.setItem("cd_ev_cars", JSON.stringify(elenco));
    const stati = eval("_RAW_STATES");
    for (const [id, valore] of [
      ["sensor.b10_battery", 62],
      ["sensor.t03_battery", 44],
    ])
      stati[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { friendly_name: id, device_class: "battery", unit_of_measurement: "%" },
      };
    window.applyStates?.();
    window.cdEvApplyCar(0);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, DUE_AUTO);
  await page.evaluate(() => document.querySelector('.tab[data-tab="ev"]')?.click());
  await page.waitForTimeout(2500);
}

/* Un fotogramma per volta: la coppia foto/forma, per tutta la durata del
 * cambio. E' l'unico modo di vedere un rimbalzo — guardare com'e' finita non
 * dice niente, perche' finisce sempre bene. */
async function fotogrammi(page, gesto, durata = 1800) {
  await page.evaluate((quanto) => {
    window.__giri = [];
    window.__basta = false;
    const img = document.getElementById("ev-mod-car-img");
    const hero = document.getElementById("lm-hero-card");
    const fine = performance.now() + quanto;
    const giro = () => {
      window.__giri.push({
        foto: String(img?.getAttribute("src") || "")
          .split("/")
          .pop(),
        forma: hero?.style?.getPropertyValue("--dm-evv-hero-ratio") || "",
      });
      if (!window.__basta && performance.now() < fine) requestAnimationFrame(giro);
    };
    requestAnimationFrame(giro);
  }, durata + 200);
  await gesto();
  await page.waitForTimeout(durata);
  /* Si spegne il registratore prima di chiudere: un giro di fotogrammi
   * lasciato acceso mentre la pagina si smonta si porta dietro il browser. */
  return page.evaluate(() => {
    window.__basta = true;
    return window.__giri;
  });
}

/* Il ritardo con cui la cornice segue la foto, contato in fotogrammi. */
function fotogrammiIndietro(giri) {
  const partenza = giri[0];
  return giri.filter((giro) => giro.foto !== partenza.foto && giro.forma === partenza.forma).length;
}

test("cambiando vettura, avanti e indietro, la cornice non resta mai indietro", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const linguette = page.locator("#ev-car-picker .dm-vehicle-profile-card[data-vehicle-key]");
  await expect(linguette).toHaveCount(2);

  /* Prima si guardano tutte e due, come fa chiunque abbia due macchine: da qui
   * in poi la plancia sa che forma hanno le loro foto. La primissima volta che
   * una foto si vede il suo formato non si puo' sapere prima di averla
   * caricata, e quella e' fisica, non un difetto. */
  await linguette.nth(1).click();
  await page.waitForTimeout(1800);
  await linguette.nth(0).click();
  await page.waitForTimeout(1800);

  const andata = await fotogrammi(page, () => linguette.nth(1).click());
  expect(andata[0].foto).toBe("b10-idle.png");
  expect(fotogrammiIndietro(andata), "la T03 e' comparsa dentro la cornice della B10").toBe(0);
  /* E la cornice e' cambiata davvero: una prova che non vede niente non prova
   * niente. */
  expect([...new Set(andata.map((giro) => giro.forma))].length).toBeGreaterThan(1);
  expect(andata.at(-1).foto).toBe("t03-idle.png");

  const ritorno = await fotogrammi(page, () => linguette.nth(0).click());
  expect(ritorno[0].foto).toBe("t03-idle.png");
  expect(fotogrammiIndietro(ritorno), "la B10 e' comparsa dentro la cornice della T03").toBe(0);
  expect(ritorno.at(-1).foto).toBe("b10-idle.png");
});

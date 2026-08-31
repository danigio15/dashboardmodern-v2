/* La caccia ai duplicati e alle sovrascritture delle telecamere.
 *
 * Dal campo: «verifica se ci sono duplicati e se c'e' qualcosa nelle
 * telecamere che si sovrascrive». Tre cose vere trovate e curate:
 * l'auto-rileva rimpiazzava la lista curata (nomi propri e flusso go2rtc
 * spariti), la modifica di una telecamera ricostruiva la riga da zero
 * buttando i campi che il form non conosce, e nel wizard la wzAddStanza
 * doppia (senza ramo di modifica) trasformava ogni modifica di stanza in
 * un doppione. Qui si prova che non succedono piu'.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [
      {
        id: "cam-corte",
        name: "Camera cortile",
        entity: "camera.ingresso",
        stream: "cortile_hd",
      },
    ],
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
  visibility: { home: true, security: true },
};

test("l'auto-rileva aggiunge, non rimpiazza", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  const esito = await page.evaluate(() => {
    /* WIZ e' un `let` lessicale del guscio: da window non si vede, ma un
     * eval nello stesso mondo si'. */
    window.eval(
      "WIZ.cameras = []; WIZ.allMeta = [" +
        '{ id: "camera.ingresso", name: "Ingresso HA" },' +
        '{ id: "camera.giardino", name: "Giardino" }];',
    );
    window.alert = () => {};
    window.wzAutoDetect();
    return window.eval("WIZ.cameras");
  });
  /* La curata resta com'era — nome suo e flusso go2rtc — e la nuova entita'
   * si accoda; l'entita' gia' configurata NON si duplica. */
  expect(esito.map((c) => c.entity)).toEqual(["camera.ingresso", "camera.giardino"]);
  expect(esito[0].name).toBe("Camera cortile");
  expect(esito[0].stream).toBe("cortile_hd");
});

test("la modifica di una telecamera non butta i campi che non conosce", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    /* La stanza scritta dall'arricchimento del registro HA: un campo che il
     * form dell'editor non ha mai avuto. */
    const cams = JSON.parse(window.localStorage.getItem("cd_cameras"));
    cams[0].room = "Corte";
    window.localStorage.setItem("cd_cameras", JSON.stringify(cams));
  });
  const dopo = await page.evaluate(async () => {
    /* I campi del form come li trova la matita: qui il form non serve aperto,
     * servono solo le caselle che edEditCamera riempie e edAddCamera legge. */
    ["ed-cam-name", "ed-cam-ent", "ed-cam-stream"].forEach((id) => {
      const el = document.createElement("input");
      el.id = id;
      document.body.append(el);
    });
    window.edEditCamera(0);
    document.getElementById("ed-cam-name").value = "Cortile ribattezzata";
    window.edAddCamera();
    await new Promise((r) => setTimeout(r, 300));
    return JSON.parse(window.localStorage.getItem("cd_cameras"));
  });
  expect(dopo).toHaveLength(1);
  expect(dopo[0].name).toBe("Cortile ribattezzata");
  expect(dopo[0].stream).toBe("cortile_hd");
  expect(dopo[0].room).toBe("Corte");
});

test("modificare una stanza nel wizard non la duplica, e la filiera morta e' morta", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  const esito = await page.evaluate(() => {
    ["wz-st-icon", "wz-st-name", "wz-st-temp", "wz-st-hum"].forEach((id) => {
      const el = document.createElement("input");
      el.id = id;
      document.body.append(el);
    });
    document.getElementById("wz-st-name").value = "Salotto nuovo";
    document.getElementById("wz-st-temp").value = "sensor.t2";
    window.wzRender = () => {};
    window.eval(
      'WIZ.stanze = [{ name: "Salotto", icon: "\u{1F3E0}", temp: "sensor.t1" }]; WIZ._editStanza = 0;',
    );
    window.wzAddStanza();
    return { stanze: window.eval("WIZ.stanze"), filieraMorta: typeof window.renderVideoHls };
  });
  /* La versione doppia di wzAddStanza (senza ramo di modifica) avrebbe
   * accodato un doppione: la vera aggiorna la riga e basta. */
  expect(esito.stanze).toHaveLength(1);
  expect(esito.stanze[0].name).toBe("Salotto nuovo");
  expect(esito.stanze[0].temp).toBe("sensor.t2");
  /* renderVideoHls era la seconda filiera video mai chiamata: rimossa. */
  expect(esito.filieraMorta).toBe("undefined");
});

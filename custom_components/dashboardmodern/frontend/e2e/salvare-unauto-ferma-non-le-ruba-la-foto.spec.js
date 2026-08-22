/* «Cavo collegato sezione B10 dava su T03, e il contrario.»
 *
 * Con due auto configurate, rimappare un'entita' di una — mentre l'altra e'
 * quella in mostra sulla plancia — non deve far finire la foto dell'auto in
 * mostra dentro al profilo di quella ferma. Il runtime cattura le due foto
 * dalle caselle piatte che seguono l'auto attiva, e l'accordion di
 * configurazione lascia modificare un'auto diversa senza prima averla resa
 * attiva: e' esattamente il momento in cui la foto passava da un'auto
 * all'altra senza che nessuno l'avesse scelta.
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

test("rimappare l'entita' di un'auto ferma non le ruba la foto di quella in mostra", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => Boolean(window.edEvCarAdd?.__dmEvSection), null, {
    timeout: 30_000,
  });

  await page.evaluate(() => {
    // Due auto, ciascuna con le sue due foto — mai le stesse fra loro.
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        {
          name: "B10",
          uid: "b10",
          brand: "Leapmotor",
          model: "B10",
          ov: {},
          img: "/local/b10-idle.png",
          imgPlugged: "/local/b10-cavo.png",
        },
        {
          name: "T03",
          uid: "t03",
          brand: "Leapmotor",
          model: "T03",
          ov: {},
          img: "/local/t03-idle.png",
          imgPlugged: "/local/t03-cavo.png",
        },
      ]),
    );
    // B10 e' quella in mostra: le caselle piatte seguono lei.
    window.cdEvApplyCar(0);
  });

  const foto = (page) =>
    page.evaluate(() => {
      const read = (k) => {
        try {
          return JSON.parse(localStorage.getItem(k) || "[]");
        } catch (_e) {
          return [];
        }
      };
      const cars = read("cd_ev_cars");
      return {
        b10: { img: cars[0]?.img, imgPlugged: cars[0]?.imgPlugged },
        t03: { img: cars[1]?.img, imgPlugged: cars[1]?.imgPlugged },
      };
    });

  expect(await foto(page)).toEqual({
    b10: { img: "/local/b10-idle.png", imgPlugged: "/local/b10-cavo.png" },
    t03: { img: "/local/t03-idle.png", imgPlugged: "/local/t03-cavo.png" },
  });

  // Si apre l'editor EV — il campo del nome profilo vive dentro al suo tab.
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await expect(page.locator("#ed-evcar-name")).toHaveCount(1);

  // Si rimappa un'entita' di T03 — che pero' non e' l'auto attiva: B10 lo e'
  // ancora, e le caselle piatte mostrano le sue foto. La mappatura si scrive
  // nella stessa casella che il runtime legge davvero (`ENTITY_OVERRIDES` e'
  // una `let` dello script legacy, non arrivabile da `window`): quella con
  // `data-ref="dm.ev_batteria_auto"`, la stessa della schermata «Batteria
  // auto (%)».
  await page.evaluate(() => {
    const nome = document.getElementById("ed-evcar-name");
    nome.value = "T03";
    const batteria = document.querySelector('.ed-slot-in[data-ref="dm.ev_batteria_auto"]');
    batteria.value = "sensor.t03_battery";
    window.edEvCarAdd();
  });

  // T03 tiene le sue foto, non quelle di B10 — e B10 non ha perso le sue.
  expect(await foto(page), "T03 non deve prendere la foto di B10").toEqual({
    b10: { img: "/local/b10-idle.png", imgPlugged: "/local/b10-cavo.png" },
    t03: { img: "/local/t03-idle.png", imgPlugged: "/local/t03-cavo.png" },
  });

  // E il verso opposto: si rende attiva T03, e si rimappa B10.
  await page.evaluate(() => {
    window.cdEvApplyCar(1);
    window.apriConfigEntita();
    window.editorSwitch("sez2");
    const nome = document.getElementById("ed-evcar-name");
    nome.value = "B10";
    const batteria = document.querySelector('.ed-slot-in[data-ref="dm.ev_batteria_auto"]');
    batteria.value = "sensor.b10_battery";
    window.edEvCarAdd();
  });

  expect(await foto(page), "B10 non deve prendere la foto di T03").toEqual({
    b10: { img: "/local/b10-idle.png", imgPlugged: "/local/b10-cavo.png" },
    t03: { img: "/local/t03-idle.png", imgPlugged: "/local/t03-cavo.png" },
  });
});

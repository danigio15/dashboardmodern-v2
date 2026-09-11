/* «Continuo a vedere sotto un caricamento e non vedo live.»
 *
 * La schermata lo diceva per intero, e non era il negoziato: dentro il popup
 * c'era l'istantanea, e la scritta «CONNESSIONE WEBRTC…» stava SOTTO, in una
 * striscia in fondo al riquadro, invece di stare in mezzo al riquadro come fa
 * sempre. Un velo che nasce con `position:absolute; inset:0` finisce in fondo
 * solo se qualcuno gli ha tolto l'assoluto — e quel qualcuno eravamo noi.
 *
 * Il fermo immagine (#476) si dipinge come fondo del riquadro, e insieme era
 * arrivata una riga per tenergli sopra i figli del guscio:
 *
 *     .dm-cam-con-fermo .cam-zoom-container>*{position:relative;z-index:1}
 *
 * Due classi contro una classe e un tipo: quella riga batte per specificita' il
 * `.cam-zoom-container video{position:absolute}` del guscio, e batte anche il
 * velo. Cosi' il video e il velo uscivano dal loro posto e cadevano in fila
 * sotto il riquadro, che con `padding-top:56.25%` ha lo spazio del contenuto
 * proprio in fondo: il video senza altezza — invisibile, e' il «non vedo live»
 * — e il velo a striscia — e' il «caricamento sotto». La riga non serviva
 * nemmeno: i piani il guscio se li da' da solo (video e immagine a 2, velo a
 * 4, pastiglia dell'audio a 6), e il velo scuro del fermo e' un pseudo-elemento
 * senza piano, quindi sta gia' sotto tutti e tre.
 *
 * Qui non si prova il WebRTC — non c'e' una casa dall'altra parte — si prova il
 * RIQUADRO mentre il WebRTC e' in volo, che e' l'istante della schermata: il
 * negoziato finto non finisce mai, il velo resta su, e il riquadro deve essere
 * quello giusto lo stesso.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LARGHEZZA = 420;

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: {},
};

test("il riquadro del video non si sfonda col fermo dietro", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  await page.evaluate((larghezza) => {
    const stati = eval("_RAW_STATES");
    stati["camera.cameretta"] = {
      entity_id: "camera.cameretta",
      state: "idle",
      attributes: {
        friendly_name: "Cameretta",
        /* Home Assistant lo dichiara: la strada e' il WebRTC nativo. */
        frontend_stream_type: "web_rtc",
        /* E l'istantanea c'e', quindi il fermo si accende: senza, la classe
         * che porta il difetto non verrebbe nemmeno messa. */
        entity_picture: "/api/camera_proxy/camera.cameretta?token=prova",
      },
    };
    window.applyStates?.();
    /* Il negoziato che non finisce: e' l'istante della schermata. */
    window.dmStartWebRTCNative = () => new Promise(() => {});
    const content = document.createElement("div");
    content.id = "prova-popup";
    content.style.cssText = `position:fixed;left:0;top:0;width:${larghezza}px;z-index:9999`;
    document.body.append(content);
    window
      .dmCamOpen({ id: "c1", name: "Cameretta", entity: "camera.cameretta" }, "Cameretta", content)
      .catch(() => {});
  }, LARGHEZZA);

  await expect(page.locator("#prova-popup #cam-video")).toHaveCount(1, { timeout: 30_000 });

  const misure = await page.evaluate(() => {
    const content = document.getElementById("prova-popup");
    const riquadro = (nodo) => {
      const box = nodo.getBoundingClientRect();
      return {
        top: Math.round(box.top),
        left: Math.round(box.left),
        larghezza: Math.round(box.width),
        altezza: Math.round(box.height),
      };
    };
    const cornice = content.querySelector("#video-iframe-container");
    const video = content.querySelector("#cam-video");
    const velo = content.querySelector("#cam-video-loader");
    return {
      conFermo: content.classList.contains("dm-cam-con-fermo"),
      posizioneVideo: getComputedStyle(video).position,
      posizioneVelo: getComputedStyle(velo).position,
      cornice: riquadro(cornice),
      video: riquadro(video),
      velo: riquadro(velo),
    };
  });

  /* Senza il fermo addosso al popup la prova non proverebbe niente: la regola
   * che rompeva parte da li'. */
  expect(misure.conFermo, "il fermo non si e' acceso: la prova guarderebbe un altro caso").toBe(
    true,
  );

  /* Il riquadro e' quello del guscio: 16:9, e non cresce per fare posto a
   * figli finiti in fila. */
  expect(misure.cornice.larghezza).toBe(LARGHEZZA);
  expect(
    Math.abs(misure.cornice.altezza - Math.round(LARGHEZZA * 0.5625)),
    "il riquadro si e' sfondato: dentro c'e' qualcosa che occupa spazio invece di stare sopra",
  ).toBeLessThanOrEqual(2);

  /* Il video riempie il riquadro. Prima stava a `position:relative` con
   * altezza zero: c'era, e non si vedeva. */
  expect(misure.posizioneVideo).toBe("absolute");
  expect(misure.video).toEqual(misure.cornice);

  /* E il velo copre il riquadro, non una striscia in fondo. */
  expect(misure.posizioneVelo).toBe("absolute");
  expect(misure.velo).toEqual(misure.cornice);
});

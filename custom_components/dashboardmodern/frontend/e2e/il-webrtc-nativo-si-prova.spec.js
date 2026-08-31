/* La telecamera che dichiara WebRTC nativo lo vede provare davvero.
 *
 * «WebRTC ancora non funzionante»: la plancia parlava solo il dialetto
 * dell'estensione go2rtc (nome del flusso) e per chi non lo compilava la
 * strada si SALTAVA — anche quando Home Assistant dichiarava di saper
 * negoziare da solo (`frontend_stream_type: "web_rtc"`). Qui il banco non ha
 * un vero Home Assistant dietro: la prova e' che la strada non viene piu'
 * saltata — la negoziazione nativa parte davvero (la si spia), e il ripiego
 * finale non chiede piu' di «compilare il nome del flusso».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "cam-1", name: "Ingresso", entity: "camera.ingresso", stream: "" }],
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
  visibility: { home: true },
};

test("la strada nativa si tenta invece di saltarla", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["camera.ingresso"] = {
      entity_id: "camera.ingresso",
      state: "streaming",
      attributes: { friendly_name: "Ingresso", frontend_stream_type: "web_rtc" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  const esito = await page.evaluate(async () => {
    /* La spia: la negoziazione nativa e' una funzione di finestra, la si
     * ricopre per sapere se parte — sul banco muore subito dopo (niente
     * websocket), ma il punto e' che PARTE. */
    const vera = window.dmStartWebRTCNative;
    const tentate = [];
    window.dmStartWebRTCNative = function (entityId, videoEl) {
      tentate.push(entityId);
      return vera.call(this, entityId, videoEl);
    };
    const cam = { entity: "camera.ingresso", name: "Ingresso", stream: "" };
    const contenitore = document.createElement("div");
    document.body.append(contenitore);
    await window.dmCamOpen?.(cam, "Ingresso", contenitore);
    return { tentate, testo: contenitore.textContent || "" };
  });
  /* La strada nativa e' stata tentata (non piu' saltata), e il ripiego non
   * chiede di compilare il nome del flusso go2rtc. */
  expect(esito.tentate).toContain("camera.ingresso");
  expect(esito.testo).not.toContain("Nome stream go2rtc");
});

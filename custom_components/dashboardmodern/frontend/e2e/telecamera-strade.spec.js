/* Aprire una telecamera non costa piu' sei secondi buttati.
 *
 * Su Ring e Arlo il video non partiva. Due motivi opposti: si provava una
 * strada che non poteva funzionare, e si smetteva di provare quella che stava
 * per riuscire.
 *
 * WebRTC si tentava sempre, perche' la condizione era «il browser sa farlo» —
 * vero dappertutto. Ma quel WebRTC li' e' go2rtc, e vuole il nome del flusso
 * che le si e' dato dentro go2rtc: il nome lo si indovinava dall'entita', e chi
 * go2rtc non ce l'ha pagava tre secondi a ogni apertura per un flusso che non
 * esiste. MJPEG, subito dopo, ne costava altri tre a una telecamera che
 * trasmette solo su richiesta e un flusso continuo non ce l'ha.
 *
 * Questa prova apre una telecamera fatta come una Ring — Home Assistant
 * dichiara `frontend_stream_type` e l'apparecchio e' fermo — e pretende che la
 * strada impossibile venga saltata, con il suo perche' scritto nei registri,
 * invece di essere aspettata, e che il giro intero resti sotto il secondo.
 *
 * Delle due saltate ne e' rimasta una: il MJPEG adesso si prova anche a chi
 * dorme, ed e' la strada che ha ridato il video alle Arlo. Il perche' sta
 * accanto all'asserzione che lo pretende.
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

test("una telecamera che dorme non fa aspettare le strade impossibili", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const registri = [];
  page.on("console", (messaggio) => registri.push(messaggio.text()));
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });

  const durata = await page.evaluate(async () => {
    const stati = eval("_RAW_STATES");
    stati["camera.ingresso_ring"] = {
      entity_id: "camera.ingresso_ring",
      state: "idle",
      attributes: { friendly_name: "Ingresso", frontend_stream_type: "hls" },
    };
    window.applyStates?.();
    const contenitore = document.createElement("div");
    document.body.append(contenitore);
    const inizio = Date.now();
    await window.dmCamOpen(
      { id: "c1", name: "Ingresso", entity: "camera.ingresso_ring" },
      "Ingresso",
      contenitore,
    );
    return Date.now() - inizio;
  });

  const cam = registri.filter((riga) => riga.startsWith("[Cam]"));
  expect(cam).toContain("[Cam] – WebRTC: senza-nome-di-flusso");
  /* Il MJPEG adesso si prova, anche a chi dorme.
   *
   * Era la seconda strada saltata, e il salto sembrava un risparmio: una
   * telecamera che trasmette su richiesta non ha un flusso continuo da dare.
   * Ma quel salto veniva deciso PRIMA di provare l'HLS, e se l'HLS regge a
   * MJPEG non ci si arriva comunque — non risparmiava niente, e valeva solo
   * nel momento in cui l'HLS aveva appena fallito, cioe' esattamente quando
   * un'altra strada dal vivo serve. Chi dorme finiva sulle istantanee, due
   * fotogrammi al secondo chiesti dal browser, mentre il proxy di Home
   * Assistant gliene darebbe altrettanti spingendoli lui: «dalla card YAML si
   * muove, dalla plancia no», visto dal vero su una Arlo. */
  expect(cam).not.toContain("[Cam] – MJPEG: telecamera-che-dorme");
  expect(cam.some((riga) => riga.startsWith("[Cam] MJPEG"))).toBe(true);
  /* E il conto dei secondi regge lo stesso, che e' il motivo per cui questa
   * prova esiste: sei secondi erano le due attese buttate, e provare il MJPEG
   * a una telecamera senza WebSocket non ne aggiunge nemmeno uno. */
  expect(durata).toBeLessThan(1000);
});

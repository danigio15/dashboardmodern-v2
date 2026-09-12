/* «Si vede un'anteprima ma le live non partono da nessuna schermata» (#502).
 *
 * La plancia sceglieva la strada del video leggendo `frontend_stream_type`
 * dagli attributi dell'entità. Home Assistant l'ha tolto nella 2025.6: da lì in
 * poi quell'attributo non c'è, e chi lo legge conclude che la telecamera non sa
 * trasmettere — niente WebRTC, niente HLS, e si finisce sul proxy dei
 * fotogrammi e poi sulle istantanee. L'anteprima si vede, la live no.
 *
 * Qui si guarda quello che la plancia CHIEDE a Home Assistant aprendo una
 * telecamera come le dichiara Home Assistant oggi: senza quell'attributo, e col
 * bit delle funzioni supportate che invece c'è sempre. Deve chiedere le
 * capacità e poi il flusso. Col codice di prima non chiedeva né l'una né
 * l'altro: andava dritta al proxy.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "c1", name: "Ingresso", entity: "camera.aarlo_ingresso" }],
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
  visibility: { security: true },
};

test("la telecamera di un Home Assistant di oggi chiede le capacità e poi il flusso", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));

  /* Un ponte finto che risponde come Home Assistant 2026: `camera/capabilities`
   * dice che sa fare HLS, `camera/stream` dà la playlist. E segna tutto quello
   * che gli viene chiesto, perché è proprio l'elenco delle domande la cosa da
   * guardare. */
  await page.addInitScript(() => {
    window.__DOMANDE__ = [];
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        window.__DOMANDE__.push(messaggio.type);
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        else if (messaggio.type === "camera/capabilities")
          risultato = { frontend_stream_types: ["hls"] };
        else if (messaggio.type === "camera/stream")
          risultato = { url: "/api/hls/finto/master_playlist.m3u8" };
        else if (messaggio.type === "call_service") risultato = {};
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["camera.aarlo_ingresso"] = {
      entity_id: "camera.aarlo_ingresso",
      state: "idle",
      attributes: {
        friendly_name: "Ingresso",
        /* NIENTE `frontend_stream_type`: è com'è oggi. Quello che resta è il
         * bit delle funzioni, che c'è sempre stato e non è mai cambiato. */
        supported_features: 2,
        entity_picture: "/api/camera_proxy/camera.aarlo_ingresso?token=prova",
      },
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });

  /* La domanda sulle capacità si fa da sé, appena la plancia è in piedi: deve
   * essere già risposta quando qualcuno apre il popup. */
  await expect
    .poll(() => page.evaluate(() => window.__DOMANDE__.includes("camera/capabilities")), {
      timeout: 20_000,
    })
    .toBe(true);

  await page.evaluate(() => {
    const content = document.createElement("div");
    content.id = "prova-popup";
    document.body.append(content);
    window
      .dmCamOpen(
        { id: "c1", name: "Ingresso", entity: "camera.aarlo_ingresso" },
        "Ingresso",
        content,
      )
      .catch(() => {});
  });

  /* E aprendo chiede il flusso: è la stessa `camera/stream` che chiede la
   * finestra di Home Assistant, ed è quella che sveglia un'Arlo. Col codice di
   * prima non partiva nessuna di queste due domande. */
  await expect
    .poll(() => page.evaluate(() => window.__DOMANDE__.includes("camera/stream")), {
      timeout: 30_000,
    })
    .toBe(true);

  /* E il lettore che si monta è quello dell'HLS, non il riquadro delle
   * istantanee: è la differenza fra un video e una fotografia. */
  await expect(page.locator("#prova-popup #cam-hls")).toHaveCount(1, { timeout: 20_000 });
});

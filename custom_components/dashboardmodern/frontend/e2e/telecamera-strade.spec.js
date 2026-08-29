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
 * dichiara `frontend_stream_type` e l'apparecchio e' fermo — e pretende che le
 * due strade impossibili vengano saltate, con il loro perche' scritto nei
 * registri, invece di essere aspettate.
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
  expect(cam).toContain("[Cam] – MJPEG: telecamera-che-dorme");
  /* Sei secondi era il conto delle due attese buttate. Un secondo e' larghezza
   * abbondante per un giro che non deve aspettare piu' niente. */
  expect(durata).toBeLessThan(1000);
});

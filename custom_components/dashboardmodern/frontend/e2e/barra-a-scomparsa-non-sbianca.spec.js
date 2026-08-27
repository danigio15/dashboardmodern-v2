/* Premere «A scomparsa» non deve lasciare bianco niente.
 *
 * Segnalazione dal telefono: toccata la scelta «👆 A scomparsa» nella card
 * della barra, la plancia e' diventata bianca — e con lei tutto Home
 * Assistant, che dietro il velo del chiosco non si vedeva piu'.
 *
 * La topologia conta: il velo e' un elemento del documento di Home Assistant,
 * non della cornice. Aperta da sola la pagina legacy non ha nessun velo da
 * lasciare in giro, quindi la prova ricostruisce il pannello come fa
 * beta30-hosted-kiosk.
 */
import { expect, test } from "@playwright/test";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const HOST_URL = "http://127.0.0.1:4173/dm-scomparsa-host.html";
const HEADER_HEIGHT = 56;

const HOST_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#eef2f7}
  .header{position:sticky;top:0;height:${HEADER_HEIGHT}px;z-index:4;background:#1976d2;color:#fff}
  .view{padding:4px}
</style></head><body>
<div class="header" id="ha-header">Home Assistant</div>
<div class="view"><dm-host id="panel"></dm-host></div>
<script type="module">
class DmHost extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;width:100%;height:calc(100dvh - ${HEADER_HEIGHT}px);overflow:hidden}" +
      "iframe{width:100%;height:100%;border:0;display:block}";
    this.frame = document.createElement("iframe");
    shadow.append(style, this.frame);
  }
}
customElements.define("dm-host", DmHost);
const panel = document.getElementById("panel");
const html = await (await fetch("/legacy/dashboard.html")).text();
panel.frame.srcdoc = html.replace(/<head(?:\\s[^>]*)?>/i, (head) => head + '<base href="/legacy/">');
window.__DM_HOST_READY__ = true;
</script></body></html>`;

async function bootHostedPlancia(page) {
  await page.addInitScript((userAgent) => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
    /* Un ponte che risponde. Quello muto lascia la plancia sulla procedura
     * guidata, e una procedura guidata non ha pagine da sbiancare. */
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        setTimeout(() => {
          this.dispatchEvent(new Event("open"));
          this.onopen?.({});
          this._say({ type: "auth_ok", ha_version: "2026.8.0" });
        }, 0);
      }
      _say(payload) {
        const evento = new MessageEvent("message", { data: JSON.stringify(payload) });
        this.onmessage?.(evento);
        this.dispatchEvent(evento);
      }
      send(raw) {
        let messaggio = {};
        try {
          messaggio = JSON.parse(raw);
        } catch (_error) {
          return;
        }
        const { id, type } = messaggio;
        if (type === "auth" || id === undefined) return;
        const vuoto = {
          get_states: [],
          get_services: {},
          get_config: { location_name: "Casa", version: "2026.8.0", unit_system: {} },
        };
        setTimeout(() => {
          this._say({
            id,
            type: "result",
            success: true,
            result: type in vuoto ? vuoto[type] : null,
          });
        }, 0);
      }
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
    try {
      localStorage.clear();
      // Senza connessione la plancia apre la procedura guidata e non c'e'
      // nessuna pagina da sbiancare: qui serve una plancia gia' configurata.
      localStorage.setItem(
        "cd_connection",
        JSON.stringify({ token: "e2e-token", ws_url: "ws://home-assistant.test/api/websocket" }),
      );
      localStorage.setItem(
        "dm_dashboard_state",
        JSON.stringify({
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
            irrigazione: { zones: [] },
            energy: {},
            entityOverrides: {},
          },
          visibility: { home: true, energy: true },
        }),
      );
    } catch (_error) {}
  }, ANDROID_UA);
  await page.route(`${HOST_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: HOST_PAGE }),
  );
  await page.goto("/dm-scomparsa-host.html");
  await page.waitForFunction(() => window.__DM_HOST_READY__ === true);
  await page.frameLocator("iframe").locator("body").waitFor();
  await page.waitForFunction(() => {
    const frame = document.getElementById("panel")?.shadowRoot?.querySelector("iframe");
    return Boolean(frame?.contentWindow?.__DASHBOARDMODERN_LEGACY_READY__);
  });
}

/* Quanta plancia c'e' davvero dentro la cornice.
 *
 * Non si guarda il centro con elementFromPoint: al primo avvio la procedura
 * guidata sta davanti e coprirebbe la misura. Si guarda se la pagina attiva
 * e' ancora disegnata e alta, che e' esattamente quello che il bianco toglie.
 */
function planciaDipinta(page) {
  return page
    .frameLocator("iframe")
    .locator("html")
    .evaluate(() => {
      const pagine = [...document.querySelectorAll(".page")].filter((pagina) => {
        const riquadro = pagina.getBoundingClientRect();
        return riquadro.height > 0 && getComputedStyle(pagina).display !== "none";
      });
      const piuAlta = pagine
        .map((pagina) => Math.round(pagina.getBoundingClientRect().height))
        .sort((a, b) => b - a)[0];
      return {
        pagineVisibili: pagine.length,
        altezzaPaginaAttiva: piuAlta || 0,
        corpoVisibile: getComputedStyle(document.body).visibility,
        altezzaCorpo: Math.round(document.body.getBoundingClientRect().height),
      };
    });
}

test("scegliere la barra a scomparsa non sbianca la plancia", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page);

  /* La soglia dice «la pagina c'e' ed e' disegnata», non «e' alta cosi'».
   *
   * Era duecento pixel, e li teneva perche' in cima alla Home c'era la card
   * del meteo: da sola ne faceva centocinquanta. Il meteo e' passato
   * nell'intestazione, e la Home di una plancia appena accesa — che e' quella
   * che questa prova costruisce, senza niente configurato — e' legittimamente
   * piu' corta. Il bianco che questa prova cerca non lascia centoventi pixel
   * di pagina: ne lascia zero. */
  const prima = await planciaDipinta(page);
  expect(prima.pagineVisibili).toBeGreaterThan(0);
  expect(prima.altezzaPaginaAttiva).toBeGreaterThan(120);

  await page
    .frameLocator("iframe")
    .locator("html")
    .evaluate(() => {
      window.wzSetNavMode("auto");
    });

  await expect.poll(() => planciaDipinta(page).then((v) => v.pagineVisibili)).toBeGreaterThan(0);
  const dopo = await planciaDipinta(page);
  expect(dopo.altezzaPaginaAttiva).toBeGreaterThan(120);
  expect(dopo.corpoVisibile).not.toBe("hidden");
  expect(dopo.altezzaCorpo).toBeGreaterThan(100);
});

test("con la barra a scomparsa Home Assistant resta sotto, non sopra il bianco", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page);

  await page
    .frameLocator("iframe")
    .locator("html")
    .evaluate(() => {
      window.wzSetNavMode("auto");
    });

  /* Il velo del chiosco copre Home Assistant apposta finche' la plancia c'e':
   * quello che non deve succedere e' che copra restando vuoto. */
  const stato = await page.evaluate(() => {
    const panel = document.getElementById("panel");
    const frame = panel?.shadowRoot?.querySelector("iframe");
    const riquadro = frame?.getBoundingClientRect();
    return {
      veloDipinto: document.elementFromPoint(10, 10)?.id || "",
      corniceAlta: Math.round(riquadro?.height || 0),
      corniceLarga: Math.round(riquadro?.width || 0),
    };
  });
  expect(stato.corniceAlta).toBeGreaterThan(200);
  expect(stato.corniceLarga).toBeGreaterThan(200);
});

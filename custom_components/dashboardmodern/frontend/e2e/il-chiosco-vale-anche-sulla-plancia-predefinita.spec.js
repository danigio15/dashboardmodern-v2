/* Il chiosco sulla plancia PREDEFINITA, che non è il pannello.
 *
 * «Se imposto plancia predefinita da utente, da smartphone continua a dare
 *  errore; invece da pc non si apre in modalità kiosk.»
 *
 * Le due strade con cui si apre questa plancia hanno la stessa faccia e una
 * topologia diversa. Dalla barra laterale si apre il PANNELLO: la cornice sta
 * dentro l'ombra dell'elemento del pannello, che è figlio della vista di Home
 * Assistant. Come dashboard predefinita si apre una dashboard Lovelace, e lì
 * in mezzo c'è una CARD: l'ombra della card dentro l'ombra del contenitore
 * della card, e la card si ritaglia da sé l'altezza sotto l'intestazione
 * (`height: calc(100dvh - var(--header-height))`).
 *
 * Il chiosco scrive addosso all'elemento che ospita la cornice — quello che
 * sta dall'altra parte della radice d'ombra — e libera gli antenati che
 * inchioderebbero un `position: fixed`. Nel pannello quella catena è corta;
 * nella card è più lunga e passa per due ombre, ed è l'unico posto dove
 * questa plancia ci passa in mezzo.
 *
 * Questa prova rifà quella catena: intestazione, contenitore della card,
 * card con la sua altezza ritagliata, cornice dentro. Il chiosco deve
 * portarla a tutto schermo come fa col pannello — e sopra l'intestazione, che
 * è la cosa che il chiosco viene a fare.
 */
import { expect, test } from "@playwright/test";

const HOST_URL = "http://127.0.0.1:4173/dm-card-kiosk-host.html";
const HEADER_HEIGHT = 56;

const HOST_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#eef2f7}
  /* L'intestazione di Lovelace: fissa, e con la sua sovrapposizione. */
  .header{position:fixed;top:0;left:0;right:0;height:${HEADER_HEIGHT}px;z-index:4;background:#1976d2;color:#fff}
  /* La vista: dove Lovelace mette la card, sotto l'intestazione. */
  #view{position:relative;margin-top:${HEADER_HEIGHT}px;padding:4px}
</style></head><body>
<div class="header" id="ha-header">Home Assistant</div>
<div id="view"><hui-card-mock id="carta"></hui-card-mock></div>
<script type="module">
/* Il contenitore della card: un'ombra in piu' fra la vista e la nostra card. */
class HuiCardMock extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:block;height:100%;overflow:hidden}";
    this.carta = document.createElement("dm-card");
    shadow.append(style, this.carta);
  }
}
customElements.define("hui-card-mock", HuiCardMock);

/* La nostra card, con lo stesso foglio che scrive \`dashboard-card.js\`:
   si ritaglia l'altezza sotto l'intestazione, e dentro tiene la cornice. */
class DmCard extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;width:100%;height:calc(100dvh - ${HEADER_HEIGHT}px);min-height:420px;overflow:hidden;background:#f8fafc}" +
      ".surface{width:100%;height:100%;min-width:0;min-height:0}" +
      "iframe{width:100%;height:100%;border:0;display:block}";
    const surface = document.createElement("div");
    surface.className = "surface";
    this.frame = document.createElement("iframe");
    surface.append(this.frame);
    shadow.append(style, surface);
  }
}
customElements.define("dm-card", DmCard);

const carta = document.getElementById("carta").carta;
const html = await (await fetch("/legacy/dashboard.html")).text();
carta.frame.srcdoc = html.replace(/<head(?:\\s[^>]*)?>/i, (head) => head + '<base href="/legacy/">');
window.__DM_CARD_HOST_READY__ = true;
</script></body></html>`;

async function bootCardPlancia(page, { search = "" } = {}) {
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event("open")), 0);
      }
      send() {}
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
    /* Si riparte puliti solo alla prima apertura: una prova che RICARICA la
     * pagina deve ritrovare quello che ha appena scelto, e uno svuotamento a
     * ogni navigazione glielo toglierebbe di mano. */
    try {
      /* Solo dalla pagina che ospita, e solo alla prima apertura: lo script
       * gira anche DENTRO la cornice, dove l'indirizzo non porta la domanda —
       * e li' svuoterebbe proprio quello che la prova ha appena scelto. */
      if (window.top === window && !/[?&]tieni=1/.test(location.search)) localStorage.clear();
    } catch (_error) {}
  });
  await page.route(`${HOST_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: HOST_PAGE }),
  );
  await page.goto(`/dm-card-kiosk-host.html${search}`);
  await page.waitForFunction(() => window.__DM_CARD_HOST_READY__ === true);
  await page.frameLocator("iframe").locator("body").waitFor();
}

/* La procedura guidata copre la plancia finché nessuno ha configurato niente,
 * e qui non c'è una casa da configurare: si toglie di mezzo. Si ASPETTA che
 * nasca prima di toglierla — nasce dopo l'avvio, e toglierla prima vuol dire
 * non toglierla affatto e ritrovarsela davanti al primo tocco. */
async function togliLaProcedura(plancia) {
  const mago = plancia.locator("#setup-wizard");
  await mago.waitFor({ state: "attached", timeout: 15_000 }).catch(() => {});
  await mago.evaluateAll((nodi) => nodi.forEach((nodo) => nodo.remove()));
  await expect(mago).toHaveCount(0);
}

/* Due di queste prove riguardano il computer, e sul computer il chiosco non si
 * accende mai da solo: schermo largo, nessun dito, barra degli indirizzi al suo
 * posto. Su un telefono si accende eccome — è il suo contratto — e lì non c'è
 * niente da accendere a mano. */
async function soloDoveNonSiAccendeDaSolo(page) {
  /* La stessa domanda che si fa il chiosco: uno schermo stretto con un dito è
   * un telefono, e su un telefono si accende da sé. La si fa alla pagina che
   * ospita, che è quella che vede lo schermo vero. */
  const telefono = await page.evaluate(
    () =>
      window.matchMedia("(max-width: 870px)").matches &&
      (Number(navigator.maxTouchPoints || 0) > 0 ||
        "ontouchstart" in window ||
        window.matchMedia("(pointer: coarse)").matches),
  );
  test.skip(telefono, "qui il chiosco si accende da solo: questa prova è quella del computer");
}

async function apriLeImpostazioni(plancia) {
  await togliLaProcedura(plancia);
  await plancia.locator("body").evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await plancia.locator('.ed-tab[data-tab="visib"]').first().click();
}

function cardGeometry(page) {
  return page.evaluate(() => {
    const carta = document.getElementById("carta").shadowRoot.querySelector("dm-card");
    const box = carta.getBoundingClientRect();
    return {
      top: Math.round(box.top),
      left: Math.round(box.left),
      height: Math.round(box.height),
      width: Math.round(box.width),
      position: getComputedStyle(carta).position,
      /* Chi dipinge nell'angolo dove sta l'intestazione: al livello del
       * documento un'ombra si annuncia col suo ospite, quindi «carta» vuol
       * dire la plancia e «ha-header» la barra di Home Assistant. */
      paintedOnTop: document.elementFromPoint(10, 10)?.id || "",
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    };
  });
}

test("dentro la card della plancia predefinita il chiosco va a tutto schermo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootCardPlancia(page, { search: "?kiosk=1" });

  const html = page.frameLocator("iframe").locator("html");
  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");

  const geometria = await cardGeometry(page);
  expect(geometria).toMatchObject({ top: 0, left: 0, position: "fixed" });
  expect(geometria.height).toBe(geometria.innerHeight);
  expect(geometria.width).toBe(geometria.innerWidth);
  /* L'intestazione di Lovelace sta a 0,0 e porta `z-index:4`: se in
   * quell'angolo si vede ancora lei, il chiosco è sotto e non è servito a
   * niente — che è esattamente «non si apre in modalità kiosk». */
  expect(geometria.paintedOnTop).toBe("carta");
});

test("e spegnendolo la card restituisce alla vista l'altezza che aveva", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootCardPlancia(page, { search: "?kiosk=1" });

  const html = page.frameLocator("iframe").locator("html");
  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");

  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("kiosk", "0");
    history.replaceState({}, "", url);
  });
  await page
    .frameLocator("iframe")
    .locator("html")
    .evaluate(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

  await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
  const dopo = await cardGeometry(page);
  expect(dopo.position, "il velo è rimasto addosso alla card").not.toBe("fixed");
  expect(dopo.top, "la card copre ancora l'intestazione").toBeGreaterThan(0);
  expect(dopo.paintedOnTop).toBe("ha-header");
});

/* E l'interruttore in ⚙️ Impostazioni, che su un computer è l'unica strada.
 *
 * Su un telefono il chiosco si accende da solo, e il dito tenuto premuto
 * sull'hamburger lo commuta. Su un computer no: lo schermo è largo, la barra
 * degli indirizzi c'è, e il chiosco resta spento finché qualcuno non lo
 * chiede. Quel «qualcuno lo chiede» è l'interruttore della scheda
 * Impostazioni, ed è per questo che è nato (#480).
 *
 * Quindi su un computer quell'interruttore non è un comodo in più: è la sola
 * cosa che possa rispondere a «da pc non si apre in modalità kiosk». */
test("l'interruttore delle Impostazioni porta la card a tutto schermo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootCardPlancia(page);

  const plancia = page.frameLocator("iframe");
  const html = plancia.locator("html");
  await soloDoveNonSiAccendeDaSolo(page);
  await apriLeImpostazioni(plancia);

  const interruttore = plancia.locator("[data-dm-chiosco-int]");
  await expect(interruttore).toBeVisible({ timeout: 15_000 });
  await expect(interruttore).toHaveAttribute("aria-checked", "false");

  await interruttore.click();

  await expect(interruttore).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  const geometria = await cardGeometry(page);
  expect(geometria).toMatchObject({ top: 0, left: 0, position: "fixed" });
  expect(geometria.height).toBe(geometria.innerHeight);
  expect(geometria.paintedOnTop).toBe("carta");
});

/* E la scelta resta: ricaricando, la plancia predefinita si riapre com'era.
 *
 * Su un computer il chiosco non si accende mai da solo — schermo largo, barra
 * degli indirizzi al suo posto — quindi tutto quello che tiene in piedi la
 * scelta di chi l'ha fatta è che venga ricordata. Se si perdesse al primo
 * ricaricamento, da un computer la plancia predefinita non si aprirebbe mai a
 * tutto schermo pur avendo l'interruttore acceso. */
test("e la scelta regge il ricaricamento, che su un computer è tutto", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootCardPlancia(page);

  const plancia = page.frameLocator("iframe");
  await soloDoveNonSiAccendeDaSolo(page);
  await apriLeImpostazioni(plancia);
  await plancia.locator("[data-dm-chiosco-int]").click();
  await expect(plancia.locator("html")).toHaveAttribute("data-dm-ios-kiosk", "true");

  await bootCardPlancia(page, { search: "?tieni=1" });

  await expect(page.frameLocator("iframe").locator("html")).toHaveAttribute(
    "data-dm-ios-kiosk",
    "true",
  );
  const geometria = await cardGeometry(page);
  expect(geometria).toMatchObject({ top: 0, left: 0, position: "fixed" });
  expect(geometria.paintedOnTop).toBe("carta");
});

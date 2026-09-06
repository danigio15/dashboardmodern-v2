/* Tornare sulla plancia non e' un avvio da capo.
 *
 * Home Assistant e' una pagina sola: quando si va su un'altra sua pagina il
 * pannello viene tolto dal documento, e con lui moriva la cornice — cioe' la
 * plancia intera. Ogni ritorno rileggeva il runtime, richiedeva gli stati,
 * rifaceva il pacchetto dell'Energia, lo storico dei widget e le miniature
 * delle telecamere: e' il «si carica lentamente» che si sente tornando.
 *
 * Qui si prova la cosa che nessuna prova a tavolino puo' provare: che la
 * cornice, spostata nel ricovero mentre e' ancora attaccata al documento,
 * tiene DAVVERO il suo documento — stessa finestra, stesso marchio, stesso
 * contenuto — e che al ritorno un pannello nuovo se la riprende invece di
 * costruirne un'altra.
 */
import { expect, test } from "@playwright/test";

const PLANCIA = `<!doctype html><html><head></head><body><main id="prova">plancia</main>
<script>window.__marchio = Math.random(); window.__giri = (window.__giri || 0) + 1;<\/script>
</body></html>`;

const INFO = {
  url_path: "planciaprova",
  config: {
    entry_ids: ["entry-1"],
    static_base: "/dashboardmodern_static/abc",
    legacy_variants: ["dashboard.html", "dashboard-en.html"],
    config_profile: "casa",
  },
};

async function apriLaScena(page) {
  /* Il documento della plancia non serve intero: quello che si guarda e' se
   * la finestra dentro la cornice e' la stessa di prima. */
  await page.route(/dashboardmodern_static\/.*\/legacy\/dashboard.*\.html/, (route) =>
    route.fulfill({ contentType: "text/html", body: PLANCIA }),
  );
  await page.goto("/e2e/helpers/parcheggio.html");
  await page.waitForFunction(() => window.__parcheggioPronto === true);
  await page.evaluate(() => {
    /* La connessione con Home Assistant e' una sola per tutta la sessione, e
     * non cambia cambiando pagina: e' anche il segno con cui la plancia da
     * parte si riconosce come «di questa casa». */
    window.__connessione = { sendMessagePromise: async () => ({}) };
    /* Come fa Home Assistant: il pannello sta dentro un contenitore suo, ed e'
     * il contenitore che sparisce quando si cambia pagina. */
    window.__monta = (info) => {
      const contenitore = document.createElement("div");
      document.getElementById("scena").append(contenitore);
      const pannello = document.createElement("dashboardmodern-panel");
      contenitore.append(pannello);
      pannello.panel = info;
      pannello.hass = {
        locale: { language: "it" },
        user: { id: "u1" },
        connection: window.__connessione,
      };
      window.__pannello = pannello;
      window.__contenitore = contenitore;
      return true;
    };
    window.__marchio = () => {
      try {
        return window.__pannello?.host?.frame?.contentWindow?.__marchio ?? null;
      } catch (_errore) {
        return null;
      }
    };
  });
}

async function marchioDellaPlancia(page) {
  await page.waitForFunction(() => typeof window.__marchio() === "number", null, {
    timeout: 15_000,
  });
  return page.evaluate(() => window.__marchio());
}

test("la plancia messa da parte torna in scena senza riavviarsi", async ({ page }) => {
  await apriLaScena(page);
  /* Il parcheggio esiste solo dove esiste lo spostamento atomico.
   *
   * `moveBefore` e' l'unico modo di spostare una cornice senza che il suo
   * documento riparta, e non tutti i motori ce l'hanno: dove manca il guscio
   * risponde di no apposta e la plancia si rimonta come ha sempre fatto — che
   * e' proprio la prova qui sotto. Si chiede al browser se sa farlo, non che
   * browser e': la capacita' arrivera' anche agli altri, e il giorno che
   * arriva questa prova gira da sola. */
  const sannoSpostare = await page.evaluate(
    () => typeof Element.prototype.moveBefore === "function",
  );
  test.skip(
    !sannoSpostare,
    "questo motore non sa spostare una cornice senza ricaricarla: la plancia riparte, ed e' la prova qui sotto",
  );
  await page.evaluate((info) => window.__monta(info), INFO);
  const primo = await marchioDellaPlancia(page);

  /* Il cambio di pagina di Home Assistant: prima l'avviso, poi il pannello che
   * sparisce. E' in quell'ordine che la cornice fa in tempo a mettersi al
   * riparo — dopo sarebbe troppo tardi, un ramo staccato non si recupera. */
  const dopoIlCambio = await page.evaluate(() => {
    history.pushState({}, "", "/config/dashboard");
    window.dispatchEvent(new CustomEvent("location-changed"));
    const cornice = (window.__cornice = document.querySelector("#dashboardmodern-ricovero iframe"));
    window.__contenitore.remove();
    return {
      alRiparo: Boolean(cornice),
      nascosto: getComputedStyle(document.getElementById("dashboardmodern-ricovero")).display,
      marchio: cornice?.contentWindow?.__marchio ?? null,
      corpo: cornice?.contentDocument?.getElementById("prova")?.textContent ?? "",
      giri: cornice?.contentWindow?.__giri ?? 0,
    };
  });
  expect(dopoIlCambio.alRiparo).toBe(true);
  expect(dopoIlCambio.nascosto).toBe("none");
  expect(dopoIlCambio.marchio).toBe(primo);
  expect(dopoIlCambio.corpo).toBe("plancia");
  expect(dopoIlCambio.giri).toBe(1);

  /* E il ritorno: Home Assistant costruisce un pannello nuovo, che ritrova la
   * plancia di prima. Stesso marchio, un giro solo: non e' ripartita. */
  await page.waitForTimeout(400);
  await page.evaluate((info) => {
    history.pushState({}, "", "/planciaprova");
    window.__monta(info);
  }, INFO);
  const secondo = await marchioDellaPlancia(page);
  expect(secondo).toBe(primo);
  const ritorno = await page.evaluate(() => {
    const cornice = window.__pannello.host.frame;
    return {
      giri: cornice.contentWindow.__giri,
      inScena: cornice.getRootNode().host === window.__pannello,
      ricoveroVuoto: !document.querySelector("#dashboardmodern-ricovero iframe"),
    };
  });
  expect(ritorno.giri).toBe(1);
  expect(ritorno.inScena).toBe(true);
  expect(ritorno.ricoveroVuoto).toBe(true);
});

test("senza il parcheggio la plancia riparte davvero da zero", async ({ page }) => {
  /* Il controllo in negativo: e' il parcheggio a salvarla, non la fortuna.
   * Tolto il pannello senza preavviso, la cornice se ne va con lui e la
   * plancia dopo e' un'altra — che e' esattamente com'era prima di questo
   * lavoro, e come resta sui browser che non sanno spostare una cornice. */
  await apriLaScena(page);
  await page.evaluate((info) => window.__monta(info), INFO);
  const primo = await marchioDellaPlancia(page);
  await page.evaluate(() => window.__contenitore.remove());
  await page.waitForTimeout(400);
  await page.evaluate((info) => window.__monta(info), INFO);
  const secondo = await marchioDellaPlancia(page);
  expect(secondo).not.toBe(primo);
});

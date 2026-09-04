import { expect, test } from "@playwright/test";

/* «Storico internet da errore.»
 *
 * Nella finestra della connettivita', al posto della cronologia dei sette
 * giorni: «Storico non disponibile — Failed to fetch».
 *
 * Questa prova ricostruisce la sola topologia in cui il difetto esiste: Home
 * Assistant che ospita la plancia dentro una cornice `srcdoc`. Aperta da sola,
 * `dashboard.html` ha un `location.host` e l'indirizzo che il guscio costruisce
 * e' giusto — il difetto e' invisibile, ed e' il motivo per cui nessuna prova
 * l'aveva mai visto.
 *
 * Dentro la cornice `location.host` e' la stringa vuota, il guscio non sa dove
 * sta e indovina `homeassistant.local:8123`. Qui quell'host non risponde
 * apposta: se la richiesta ci va, la finestra scrive «Failed to fetch», che e'
 * esattamente la schermata arrivata dal campo.
 *
 * Poi il campo ha detto un'altra cosa (dalla 1.4.7): dentro il pannello la
 * plancia non ha un gettone, e una richiesta REST che «torna a casa» risponde
 * 401 — con una notifica «Login attempt failed» a ogni giro. La cronologia
 * non esce piu' di casa via REST: la domanda passa dal socket autenticato, e
 * per sette giorni prova prima le statistiche del Recorder (che un contatto
 * non ha) e poi la storia. Il socket finto qui sotto risponde come farebbe
 * Home Assistant, e la prova guarda che nessuna richiesta REST parta.
 */

/* La pagina che ospita, come la costruisce Home Assistant: una cornice
 * `srcdoc`, e dentro i tre segnali che il preludio del pannello mette davvero
 * — la plancia e' ospitata, il suo «gettone» e' un segnale che dice «i cookie
 * bastano», e la connessione che le viene passata porta il `location.host`
 * della cornice, che dentro `srcdoc` e' la stringa vuota. E' da li' che il
 * guscio finisce a indovinare l'host. */
const HOST_URL = "http://127.0.0.1:4173/dm-cornice-host.html";
const HOST_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#eef2f7}iframe{width:100%;height:100vh;border:0;display:block}</style>
</head><body>
<iframe id="cornice"></iframe>
<script type="module">
const html = await (await fetch("/legacy/dashboard.html")).text();
document.getElementById("cornice").srcdoc =
  html.replace(
    /<head(?:\\s[^>]*)?>/i,
    (head) =>
      head +
      '<base href="/legacy/">' +
      '<script>window.__DASHBOARDMODERN_HOSTED__=true;' +
      'window.__DASHBOARDMODERN_REAL_TOKEN__="__dashboardmodern_hosted__";' +
      'window.__DASHBOARDMODERN_CONNECTION__=' +
      '{token:"__dashboardmodern_hosted__",local_ip:window.location.host,remote_url:""};' +
      '<\\/script>',
  );
window.__DM_CORNICE_PRONTA__ = true;
</script></body></html>`;

const CASELLA = "dm.server_raggiungibilita_google";
const ENTITA = "binary_sensor.internet_di_casa";

const ora = Date.UTC(2026, 8, 3, 12, 0, 0);
const quando = (oreFa) => new Date(ora - oreFa * 3600000).toISOString();
/* La storia come la scrive il socket: `s` e `lu` (secondi), non le righe REST. */
const STORIA_SOCKET = [
  { s: "on", lu: (ora - 72 * 3600000) / 1000 },
  { s: "off", lu: (ora - 30 * 3600000) / 1000 },
  { s: "on", lu: (ora - 29 * 3600000) / 1000 },
];

async function planciaNellaCornice(page) {
  await page.addInitScript(
    ({ storia, entita }) => {
      /* Le domande arrivate al socket, per poterle guardare dalla prova. */
      window.__dmDomande = [];
      class PonteFinto extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          setTimeout(() => this.dispatchEvent(new Event("open")), 0);
        }
        send(raw) {
          let m;
          try {
            m = JSON.parse(raw);
          } catch (_errore) {
            return;
          }
          if (!m || m.type === "auth") return;
          window.__dmDomande.push(m);
          let result = null;
          /* Un contatto non ha statistiche: Home Assistant risponde vuoto. */
          if (m.type === "recorder/statistics_during_period") result = {};
          if (m.type === "history/history_during_period") {
            result = {};
            for (const id of m.entity_ids || []) result[id] = id === entita ? storia : [];
          }
          if (result === null) return;
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
            });
          }, 0);
        }
        close() {}
      }
      window.WebSocket = PonteFinto;
      try {
        localStorage.clear();
      } catch (_errore) {}
    },
    { storia: STORIA_SOCKET, entita: ENTITA },
  );
  await page.route(`${HOST_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: HOST_PAGE }),
  );
  await page.goto("/dm-cornice-host.html");
  await page.waitForFunction(() => window.__DM_CORNICE_PRONTA__ === true);
  const cornice = page.frames().find((frame) => frame !== page.mainFrame());
  await cornice.locator("body").waitFor();
  /* Il guscio si carica dopo il corpo, e la finestra della connettivita' la
     apre una sua funzione: si aspetta quella, che e' il segnale che il guscio
     c'e' davvero. */
  await cornice.waitForFunction(() => typeof window.apriSrvHistory === "function");
  await cornice.waitForFunction(() => window.fetch.__dmIndirizzoDiCasa === true);
  await cornice.waitForFunction(() => window.fetch.__dmIndirizzoDiCasa === true);
  return cornice;
}

test.describe("lo storico della connettivita', dentro la cornice", () => {
  test("la cronologia arriva dal socket, e la casella prende il suo nome", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    /* L'host indovinato non risponde: se la richiesta va li', la finestra
     * scrive «Failed to fetch» e la prova cade dove e' caduta la casa vera. */
    await page.route(
      (url) => url.hostname === "homeassistant.local",
      (route) => route.abort(),
    );

    /* E nemmeno a casa deve arrivare una richiesta REST: senza gettone
     * risponderebbe 401. Se ne parte una, qui la si vede. */
    const chieste = [];
    await page.route("http://127.0.0.1:4173/api/history/period/**", (route) => {
      chieste.push({
        url: route.request().url(),
        autorizzazione: route.request().headers().authorization ?? "",
      });
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });

    const cornice = await planciaNellaCornice(page);

    // Il guscio, dentro la cornice, non sa dove sta.
    expect(await cornice.evaluate(() => location.host)).toBe("");
    expect(await cornice.evaluate(() => HA_HTTP_URL)).toContain("homeassistant.local");

    /* La casella della connettivita' mappata su un'entita' vera.
     *
     * La mappatura si mette nel magazzino e non solo con
     * `cdApplyCanonicalOverrides`: quella funzione la richiamano anche le
     * sezioni, passandole quello che il magazzino contiene, e una mappatura
     * scritta soltanto a mano sparirebbe al primo giro. */
    await cornice.evaluate(
      ([casella, entita]) => {
        window.DashboardModernModules?.store?.replaceSection?.("entityOverrides", {
          [casella]: entita,
        });
        window.cdApplyCanonicalOverrides({ [casella]: entita });
      },
      [CASELLA, ENTITA],
    );
    await cornice.waitForFunction(
      ([casella, entita]) => window.resolveEntity?.(casella) === entita,
      [CASELLA, ENTITA],
    );

    await cornice.evaluate(() => window.apriSrvHistory("connettivita"));

    const timeline = cornice.locator("#srv-hist-timeline");
    await expect(timeline.locator(".srv-history-event")).toHaveCount(3);
    await expect(timeline).not.toContainText("Storico non disponibile");
    await expect(timeline).not.toContainText("Nessun dato storico");
    await expect(timeline.locator(".srv-event-state").first()).toContainText("Online");

    // Niente REST: la cronologia e' passata dal socket.
    expect(chieste).toHaveLength(0);
    const domande = await cornice.evaluate(() => window.__dmDomande);
    /* Sette giorni: prima le statistiche, che un contatto non ha, poi la
     * storia. E la domanda nomina l'entita' vera, non la casella. */
    const statistiche = domande.filter((m) => m.type === "recorder/statistics_during_period");
    const storie = domande.filter((m) => m.type === "history/history_during_period");
    expect(statistiche.length).toBeGreaterThanOrEqual(1);
    expect(statistiche[0].statistic_ids).toEqual([ENTITA]);
    expect(storie).toHaveLength(1);
    expect(storie[0].entity_ids).toEqual([ENTITA]);
    expect(JSON.stringify(storie[0])).not.toContain(CASELLA);

    await testInfo.attach("storico-connettivita.png", {
      body: await cornice.locator("#srv-hist-overlay").screenshot(),
      contentType: "image/png",
    });
  });

  test("una casella senza entita' resta com'e', e la finestra lo dice", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route(
      (url) => url.hostname === "homeassistant.local",
      (route) => route.abort(),
    );
    const chieste = [];
    await page.route("http://127.0.0.1:4173/api/history/period/**", (route) => {
      chieste.push(route.request().url());
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });

    const cornice = await planciaNellaCornice(page);
    await cornice.evaluate(() => window.apriSrvHistory("connettivita"));

    /* La domanda parte lo stesso, dal socket: quello che manca e' la
     * mappatura, e la risposta vuota, li', e' la verita'. Sostituirla con
     * l'entita' di un'altra casella sarebbe peggio del non rispondere. */
    await expect(cornice.locator("#srv-hist-timeline")).toContainText("Nessun dato storico");
    expect(chieste).toHaveLength(0);
    const storie = await cornice.evaluate(() =>
      window.__dmDomande.filter((m) => m.type === "history/history_during_period"),
    );
    expect(storie).toHaveLength(1);
    expect(storie[0].entity_ids).toEqual([CASELLA]);
  });
});

import { expect, test } from "@playwright/test";
import { ATTESA_MASSIMA_DELLA_BARRA } from "../src/sections/navigation-section.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Resta sempre la barra totale, per poi diventare come l'ho configurata: dura
 * quattro o cinque secondi.»
 *
 * Il guscio applica la visibilita' delle voci a tempo — subito, a 1,5 s, poi
 * ogni tre secondi — mentre la configurazione arriva quando arriva. Fra i due
 * momenti la barra mostra forme che poi si rimangia: misurate dall'avvio, erano
 * quattro, e tre di queste erano false.
 *
 * Il contratto che questa prova fissa e' uno solo, e non parla di tempi: da
 * quando la barra si vede, la sua forma non cambia piu'. Che ci metta mezzo
 * secondo o tre non e' affare di nessuno; che dica una cosa e poi un'altra si'.
 */

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salotto", entities: [] }],
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
  /* Due sezioni accese e tutte le altre spente: una barra che ha una forma
   * ben diversa da quella di serie, cosi' una forma sbagliata si vede. */
  visibility: {
    home: true,
    energy: true,
    appliances: false,
    ev: false,
    boiler: false,
    clima: false,
    temp: false,
    security: false,
    server: false,
    tapparelle: false,
    irrigazione: false,
    piscina: false,
  },
};

/* Il campionatore parte col documento, prima che il guscio disegni: quello che
 * si vuole cogliere succede nei primi due secondi. */
async function guardaLaBarra(page) {
  await page.addInitScript(() => {
    window.__FORME_DELLA_BARRA__ = [];
    const inizio = Date.now();
    const giro = () => {
      const barra = document.querySelector("nav.tabs.bottom-nav-bar");
      const voci = [...document.querySelectorAll("nav.tabs .tab")];
      if (barra && voci.length && getComputedStyle(barra).opacity !== "0") {
        const firma = voci
          .filter((nodo) => getComputedStyle(nodo).display !== "none")
          .map((nodo) => nodo.dataset.tab)
          .join(",");
        const ultima = window.__FORME_DELLA_BARRA__[window.__FORME_DELLA_BARRA__.length - 1];
        if (!ultima || ultima.firma !== firma) {
          window.__FORME_DELLA_BARRA__.push({ ms: Date.now() - inizio, firma });
        }
      }
      if (Date.now() - inizio < 8000) setTimeout(giro, 30);
    };
    setTimeout(giro, 0);
  });
}

test("da quando si vede, la barra non cambia piu' forma", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await guardaLaBarra(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  /* Si aspetta che si sia assestata: la forma finale la decide la
   * configurazione, e su questa casa non contiene ne' Sicurezza ne' MiniPC. */
  const barra = page.locator("nav.tabs.bottom-nav-bar");
  await expect(barra).not.toHaveCSS("opacity", "0");
  await expect(page.locator('nav.tabs .tab[data-tab="security"]')).toBeHidden();
  await expect(page.locator('nav.tabs .tab[data-tab="energy"]')).toBeVisible();
  await page.waitForTimeout(4000);

  const forme = await page.evaluate(() => window.__FORME_DELLA_BARRA__);
  const elenco = forme.map((f) => `${f.ms}ms [${f.firma}]`).join("\n  ");
  expect(forme.length, `la barra ha cambiato forma sotto gli occhi:\n  ${elenco}`).toBe(1);

  /* E la forma unica e' quella configurata, non quella di serie. */
  expect(forme[0].firma).not.toContain("security");
  expect(forme[0].firma).toContain("home");
  expect(forme[0].firma).toContain("energy");
});

test("una voce di una sezione spenta non compare nemmeno per un attimo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await guardaLaBarra(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await expect(page.locator("nav.tabs.bottom-nav-bar")).not.toHaveCSS("opacity", "0");
  await page.waitForTimeout(4000);

  /* Le voci che mettono i moduli arrivano dopo quelle del guscio, e il guscio
   * le filtrava al giro successivo: fra i due momenti la voce di una sezione
   * spenta stava li' in mezzo alle altre. */
  const forme = await page.evaluate(() => window.__FORME_DELLA_BARRA__);
  for (const spenta of ["security", "server", "piscina", "irrigazione", "clima"]) {
    for (const forma of forme) {
      expect(
        forma.firma.split(",").includes(spenta),
        `«${spenta}» si e' vista a ${forma.ms}ms: [${forma.firma}]`,
      ).toBe(false);
    }
  }
});

/* E chi non ha nessuno a cui chiedere non aspetta.
 *
 * La barra resta coperta finche' non sa che forma avere, e quella la porta la
 * configurazione condivisa di Home Assistant. Ma una plancia aperta da sola —
 * fuori dal pannello, senza ponte — quella configurazione non la ricevera' mai:
 * aspettarla vuol dire arrivare sempre alla scadenza, e la scadenza e'
 * l'ultimo appello, non il modo normale di uscire. La domanda ha due risposte,
 * e «non c'e' niente da chiedere» e' una risposta anche lei.
 */
test("senza Home Assistant a cui chiedere la barra non aspetta la scadenza", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((seme) => {
    try {
      localStorage.clear();
      localStorage.setItem("dm_dashboard_state", JSON.stringify(seme));
      /* Con un gettone in tasca la plancia non apre la procedura guidata, che
       * di barre non ne ha nessuna. */
      localStorage.setItem(
        "cd_connection",
        JSON.stringify({ token: "e2e-token", ws_url: "ws://home-assistant.test/api/websocket" }),
      );
    } catch (_errore) {}
    const inizio = Date.now();
    const guarda = () => {
      if (!document.documentElement) return setTimeout(guarda, 5);
      const segna = () => {
        if (document.documentElement.dataset.dmBarra !== "pronta") return;
        if (window.__QUANDO_LA_BARRA_ESCE__ == null)
          window.__QUANDO_LA_BARRA_ESCE__ = Date.now() - inizio;
      };
      new MutationObserver(segna).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-dm-barra"],
      });
      segna();
    };
    guarda();
  }, seed);

  /* Senza `?dmi=` e senza ponte: e' la pagina aperta da sola. */
  await page.goto("/legacy/dashboard.html");
  await expect
    .poll(() => page.evaluate(() => window.__QUANDO_LA_BARRA_ESCE__ ?? null), {
      timeout: ATTESA_MASSIMA_DELLA_BARRA + 10_000,
    })
    .not.toBeNull();

  const quando = await page.evaluate(() => window.__QUANDO_LA_BARRA_ESCE__);
  expect(
    quando,
    `la barra e' uscita a ${quando} ms: e' la scadenza (${ATTESA_MASSIMA_DELLA_BARRA} ms), non una risposta`,
  ).toBeLessThan(ATTESA_MASSIMA_DELLA_BARRA);
});

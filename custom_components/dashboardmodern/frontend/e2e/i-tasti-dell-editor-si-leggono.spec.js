/* «Cambia il colore del pulsante aggiungi da integrazione perché la scritta
 * non si vede.»
 *
 * `.ed-btn-add` nasce celeste con la scritta blu. Chi vuole un tasto che
 * spicchi gli cambia il fondo — un gradiente scuro, un grigio — e si dimentica
 * la scritta, che resta blu: sul celeste si leggeva, sullo scuro no. E'
 * successo tre volte in tre punti diversi, e ogni volta se ne accorge chi usa
 * la plancia, non chi la scrive.
 *
 * Questa prova non guarda i colori scelti: guarda il contrasto vero fra la
 * scritta e il fondo su cui finisce, tasto per tasto, in tutte le schede
 * dell'editor. Un fondo scuro con la scritta scura non passa, qualunque siano
 * i due colori.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-lavanderia", name: "Lavanderia", icon: "🧺", metadata: {} }],
    cameras: [],
    appliances: [
      {
        id: "appl-lavatrice",
        name: "Lavatrice",
        visual_key: "lavatrice",
        device_type: "lavatrice",
        power_entity: "sensor.lavatrice_power",
        device_id: "wm-1",
        integration: "hon",
        integration_name: "Haier hOn Revived",
        device_name: "Lavatrice",
        device_entities: ["sensor.lavatrice_power"],
        show_in_dashboard: true,
      },
    ],
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
  visibility: { home: true, appliances: true },
};

/* Il contrasto come lo definisce il WCAG, calcolato nella pagina sui colori
 * che il browser ha davvero applicato — non su quelli scritti nel foglio. */
const MISURA = `
  (() => {
    const canale = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminanza = ([r, g, b]) =>
      0.2126 * canale(r / 255) + 0.7152 * canale(g / 255) + 0.0722 * canale(b / 255);
    const numeri = (testo) => (testo.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
    /* Di un gradiente contano tutte le fermate: la scritta ci passa sopra
       tutte, e basta la peggiore per non leggersi. */
    const fondi = (nodo) => {
      const stile = getComputedStyle(nodo);
      const dipinti = [];
      for (const pezzo of stile.backgroundImage.matchAll(/rgba?\\([^)]*\\)/g))
        dipinti.push(numeri(pezzo[0]));
      const tinta = stile.backgroundColor;
      if (!/rgba\\(0, 0, 0, 0\\)|transparent/.test(tinta)) dipinti.push(numeri(tinta));
      if (dipinti.length) return dipinti;
      /* Un tasto senza fondo suo sta su quello di chi lo contiene. */
      let padre = nodo.parentElement;
      while (padre) {
        const t = getComputedStyle(padre).backgroundColor;
        if (!/rgba\\(0, 0, 0, 0\\)|transparent/.test(t)) return [numeri(t)];
        padre = padre.parentElement;
      }
      return [[255, 255, 255]];
    };
    const contrasto = (a, b) => {
      const [chiaro, scuro] = a > b ? [a, b] : [b, a];
      return (chiaro + 0.05) / (scuro + 0.05);
    };
    return [...document.querySelectorAll("#ed-body .ed-btn-add")]
      .filter((nodo) => nodo.offsetParent !== null)
      .map((nodo) => {
        const scritta = luminanza(numeri(getComputedStyle(nodo).color));
        const peggiore = Math.min(...fondi(nodo).map((fondo) => contrasto(scritta, luminanza(fondo))));
        return {
          testo: nodo.textContent.replaceAll(/\\s+/g, " ").trim().slice(0, 40),
          contrasto: Math.round(peggiore * 100) / 100,
        };
      });
  })()
`;

async function boot(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Con un ponte che risponde la scheda Elettrodomestici mostra anche il tasto
   * «Aggiungi da un'integrazione», che e' quello da cui e' partita la
   * segnalazione: senza, la prova misurerebbe tutti gli altri e non lui. */
  await page.addInitScript(() => {
    class PonteFinto {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        else if (messaggio.type === "dashboardmodern/integrations/catalog")
          risultato = { integrations: [], devices: [], entities: [] };
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
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* I moduli si installano quando il runtime e' pronto: aprire l'editor prima
   * vuol dire misurare una scheda che nessuno ha ancora rivestito. */
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

/* Le schede dove i tasti hanno un fondo suo — coi nomi che usa la plancia. */
const SCHEDE = ["appliances", "stanze", "luci", "load", "sezioni"];

for (const tema of ["light", "dark"]) {
  test(`i tasti dell'editor si leggono, tema ${tema}`, async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate((scelto) => {
      document.documentElement.setAttribute("data-theme", scelto);
    }, tema);

    for (const scheda of SCHEDE) {
      await page.evaluate((nome) => {
        window.apriConfigEntita?.();
        window.editorSwitch?.(nome);
        /* I moduli si rivestono quando l'editor dice di aver disegnato: e' il
         * segnale che manda il runtime, e senza aspettarlo si misurerebbe la
         * scheda a meta'. */
        window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered"));
      }, scheda);
      await page.waitForTimeout(600);
      const tasti = await page.evaluate(MISURA);
      expect(tasti.length, `${scheda}: nessun tasto da misurare`).toBeGreaterThan(0);
      /* E fra questi ci deve essere quello della segnalazione. */
      if (scheda === "appliances")
        expect(
          await page.locator("#ed-body [data-dm-integ-add]").count(),
          "manca il tasto «Aggiungi da un'integrazione»",
        ).toBe(1);
      for (const tasto of tasti) {
        expect(
          tasto.contrasto,
          `${scheda} · «${tasto.testo}»: contrasto ${tasto.contrasto}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

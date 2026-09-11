/* «In the home configuration, it is possible to change the position of the
 * blocks; it would be nice if it were also possible to change the position of
 * the header containing the weather» (#492).
 *
 * Qui si fa il gesto vero, e si misura quello che vede una persona: si apre la
 * scheda Home dell'editor, si porta «Persone» sopra «Intestazione col meteo»
 * con la freccia, e si guarda dov'e' finito il riquadro.
 *
 * Due misure, non una. La prima e' dove sta: prima figlio dell'intestazione,
 * dopo figlio della Home, sotto le persone. La seconda e' come sta: dentro il
 * riquadro il meteo resta piccolo — icona e temperatura da fascia, non da card
 * intera — perche' e' il riquadro a renderlo tale, non la casa che lo ospita.
 * Senza la seconda, questa prova passerebbe anche con un riquadro spostato e
 * sfondato, che e' esattamente il modo in cui questa cosa poteva rompersi.
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
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.home_meteo": "weather.casa" },
    people: [{ id: "p1", name: "Giovanni", entity: "person.giovanni" }],
  },
  visibility: { home: true },
};

const STATI = [
  { entity_id: "person.giovanni", state: "home", attributes: { friendly_name: "Giovanni" } },
  {
    entity_id: "weather.casa",
    state: "partlycloudy",
    attributes: { friendly_name: "Meteo", temperature: 21.4, humidity: 47, wind_speed: 9 },
  },
];

/* Dove sta il riquadro, e quanto e' grande quello che ci sta dentro. */
const dovEIlRiquadro = (page) =>
  page.evaluate(() => {
    const riga = document.querySelector(".dm-testata-riga");
    if (!riga) return null;
    const padre = riga.parentElement;
    const meteo = riga.querySelector(".weather-widget");
    const icona = riga.querySelector(".w-icon");
    const temperatura = riga.querySelector(".w-temp");
    const misura = (nodo) => (nodo ? Math.round(nodo.getBoundingClientRect().height) : null);
    const fondo = meteo ? getComputedStyle(meteo).backgroundImage : "";
    return {
      quanti: document.querySelectorAll(".dm-testata-riga").length,
      inTestata: padre?.tagName === "HEADER",
      inPagina: padre?.id === "page-home",
      /* Sotto le persone: l'indice fra i figli della Home. */
      dopoLePersone:
        padre?.id === "page-home"
          ? [...padre.children].indexOf(riga) >
            [...padre.children].indexOf(document.getElementById("dm-people"))
          : null,
      altezzaIcona: misura(icona),
      altezzaMeteo: misura(meteo),
      temperatura: temperatura ? getComputedStyle(temperatura).fontSize : "",
      /* Il fondo da card intera e' un gradiente: dentro il riquadro non ci
       * deve essere, o si vede una cornice dentro l'altra. */
      gradiente: fondo && fondo !== "none",
    };
  });

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
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
        let risultato = null;
        if (messaggio.type === "get_states") risultato = haStates;
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
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
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((haStates) => {
    haStates.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
    localStorage.setItem(
      "cd_people",
      JSON.stringify([{ id: "p1", name: "Giovanni", entity: "person.giovanni" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATI);
}

test("il riquadro col meteo scende in pagina, e resta piccolo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  /* Come sta di serie: nell'intestazione, uno solo, col meteo gia' rimpicciolito. */
  await expect
    .poll(() => dovEIlRiquadro(page), { timeout: 20_000 })
    .toMatchObject({
      quanti: 1,
      inTestata: true,
    });
  const prima = await dovEIlRiquadro(page);
  expect(prima.gradiente).toBe(false);
  expect(prima.altezzaIcona).toBeLessThanOrEqual(30);
  const altezzaPrima = prima.altezzaMeteo;
  const temperaturaPrima = prima.temperatura;

  /* Il gesto: la scheda Home dell'editor, e la freccia su «Persone» — che nella
   * fila sta subito sotto il meteo, quindi un colpo solo li scambia. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const rigaMeteo = page.locator('#ed-body [data-dm-home-blocchi] [data-blocco="meteo"]');
  await expect(rigaMeteo).toBeVisible({ timeout: 20_000 });
  await expect(rigaMeteo).toContainText(/Intestazione col meteo|Weather header/);
  await page.locator('#ed-body [data-blocco="persone"] [data-blocco-su]').click();

  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_home_blocchi") || "null")))
    .toEqual(["persone", "meteo", "widget", "azioni", "stanze", "dispositivi"]);

  /* E la Home lo mostra: sceso in pagina, sotto le persone, ancora uno solo. */
  await page.evaluate(() => document.getElementById("editor-modal")?.classList.remove("show"));
  await expect
    .poll(() => dovEIlRiquadro(page), { timeout: 20_000 })
    .toMatchObject({
      quanti: 1,
      inTestata: false,
      inPagina: true,
      dopoLePersone: true,
    });

  /* E com'e' sceso: uguale a com'era. Il difetto che questa misura impedisce e'
   * il meteo che, fuori dall'intestazione, tornava alla taglia da card intera —
   * icona a settanta, temperatura a cinquantadue, e il gradiente sotto. */
  const dopo = await dovEIlRiquadro(page);
  expect(dopo.gradiente).toBe(false);
  expect(dopo.altezzaIcona).toBe(prima.altezzaIcona);
  expect(dopo.temperatura).toBe(temperaturaPrima);
  expect(Math.abs(dopo.altezzaMeteo - altezzaPrima)).toBeLessThanOrEqual(2);

  /* E tornando indietro torna nell'intestazione: la freccia va nei due sensi. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  await page.locator('#ed-body [data-blocco="meteo"] [data-blocco-su]').click();
  await page.evaluate(() => document.getElementById("editor-modal")?.classList.remove("show"));
  await expect
    .poll(() => dovEIlRiquadro(page), { timeout: 20_000 })
    .toMatchObject({ quanti: 1, inTestata: true });
});

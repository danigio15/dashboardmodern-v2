/* «I numeri dei giorni della settimana non selezionati sono visualizzati in
 *  nero e di difficile distinzione su sfondo di un colore simile» (#425).
 *
 * Solo col tema scuro: col chiaro andava tutto bene. Il numero chiedeva
 * `var(--text-color,…)`, un nome che non esiste da nessuna parte, e prendeva
 * sempre il suo ripiego scritto a mano — il nero del tema chiaro.
 *
 * Un colore sbagliato non si vede rileggendo il codice: la riga sembra giusta.
 * Si vede misurando il contrasto fra la scritta e il fondo su cui cade, che e'
 * quello che fa l'occhio di chi guarda. Qui si misura, nei due temi.
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
    entityOverrides: {},
  },
  visibility: { home: true, calendario: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Un calendario configurato: senza, la voce dell'agenda non compare in
   * barra. Gli appuntamenti non servono — la fascia dei giorni la disegna il
   * calendario, non quello che ci sta dentro. */
  await page.evaluate(() => {
    _RAW_STATES["calendar.famiglia"] = {
      entity_id: "calendar.famiglia",
      state: "off",
      attributes: { friendly_name: "Famiglia" },
    };
    STATES["calendar.famiglia"] = structuredClone(_RAW_STATES["calendar.famiglia"]);
    localStorage.setItem(
      "cd_calendari",
      JSON.stringify([{ id: "cal-casa", entity: "calendar.famiglia", name: "Famiglia" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.locator('.tab[data-tab="calendario"]').click();
  await expect(page.locator("#page-calendario")).toHaveClass(/active/);
  await expect(page.locator("#page-calendario .dm-calp-cella").first()).toBeVisible({
    timeout: 15_000,
  });
}

/* Il contrasto come lo definisce la regola d'accessibilita': una scritta
 * piccola vuole almeno 4,5 volte. Il fondo lo si cerca risalendo i genitori
 * finche' uno non e' trasparente — e' quello che si vede davvero sotto. */
function contrastoDeiGiorni(page) {
  return page.evaluate(() => {
    const canale = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const leggi = (testo) => (testo.match(/[\d.]+/g) || []).map(Number);
    const luce = ([r, g, b]) =>
      0.2126 * canale(r / 255) + 0.7152 * canale(g / 255) + 0.0722 * canale(b / 255);
    const opaco = (nodo) => {
      for (let n = nodo; n; n = n.parentElement) {
        const sfondo = getComputedStyle(n).backgroundColor;
        const parti = leggi(sfondo);
        if (parti.length >= 3 && (parti.length < 4 || parti[3] > 0.9)) return parti.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const misure = [];
    for (const cella of document.querySelectorAll("#page-calendario .dm-calp-cella")) {
      if (cella.dataset.oggi === "true" || cella.dataset.scelto === "true") continue;
      const numero = cella.querySelector(".dm-calp-numero");
      if (!numero) continue;
      const davanti = luce(leggi(getComputedStyle(numero).color).slice(0, 3));
      const dietro = luce(opaco(numero));
      const alto = Math.max(davanti, dietro);
      const basso = Math.min(davanti, dietro);
      misure.push(Math.round(((alto + 0.05) / (basso + 0.05)) * 100) / 100);
    }
    return { quanti: misure.length, peggiore: Math.min(...misure) };
  });
}

test("i numeri dei giorni si leggono col tema chiaro e col tema scuro", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const chiaro = await contrastoDeiGiorni(page);
  expect(chiaro.quanti).toBeGreaterThan(0);
  expect(chiaro.peggiore).toBeGreaterThanOrEqual(4.5);

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  const scuro = await contrastoDeiGiorni(page);
  expect(scuro.quanti).toBe(chiaro.quanti);
  /* Prima della correzione qui usciva circa 1,4: nero su blu notte. */
  expect(scuro.peggiore).toBeGreaterThanOrEqual(4.5);
});

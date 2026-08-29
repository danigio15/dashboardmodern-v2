/* All'avvio non si vede la plancia del guscio.
 *
 * «Quando faccio refresh della pagina compare la vecchia sezione di azioni
 * rapide e anche il meteo e' quello grande, come se ci fosse una versione
 * vecchia sotto.»
 *
 * Sotto non c'e' niente: il guscio disegna una sua Home, i moduli gliela
 * riscrivono addosso quando sono installati, e fra le due cose passa piu' di un
 * secondo. Il velo di avvio pero' se ne andava all'inizio di quel secondo — lo
 * toglieva il guscio appena finiva il suo pezzo — e in quel buco si vedeva la
 * plancia vecchia, che poi si spostava sotto gli occhi.
 *
 * Questa prova guarda ogni fotogramma dell'avvio e pretende che non ci sia
 * nemmeno un istante in cui il velo se n'e' andato e i moduli non hanno ancora
 * preso in mano niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
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
  },
  visibility: {},
};

for (const variante of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variante}: fra il velo e i moduli non si vede la plancia del guscio`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    /* Il campionatore si installa prima di qualunque script della pagina e
     * guarda a ogni fotogramma: c'e' ancora il velo? i moduli sono
     * installati? Un fotogramma senza velo e senza moduli e' il difetto. */
    await page.addInitScript(() => {
      window.__scoperti = [];
      const guarda = () => {
        const velo = Boolean(document.getElementById("cd-boot-overlay"));
        const moduli = Boolean(window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed);
        if (!velo && !moduli) window.__scoperti.push(Math.round(performance.now()));
        if (!moduli) requestAnimationFrame(guarda);
      };
      requestAnimationFrame(guarda);
    });

    await bootNamespacedDashboard(page, variante, testInfo, SEME);
    await expect
      .poll(
        () => page.evaluate(() => Boolean(window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed)),
        {
          timeout: 30_000,
        },
      )
      .toBe(true);

    const scoperti = await page.evaluate(() => window.__scoperti || []);
    expect(
      scoperti,
      `la plancia del guscio si e' vista per ${scoperti.length} fotogrammi, a partire da ${scoperti[0]} ms`,
    ).toEqual([]);
  });
}

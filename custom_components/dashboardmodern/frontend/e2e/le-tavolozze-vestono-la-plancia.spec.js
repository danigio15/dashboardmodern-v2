/* «Quando è possibile avere qualche tema in più, grazie» (#436).
 *
 * Che i colori si leggano lo prova l'aritmetica, senza browser
 * (`le-tavolozze-si-leggono-tutte`). Qui si prova il collegamento: che i tasti
 * compaiano nella pagina Config sotto i tre di sempre, che sceglierne uno
 * vesta davvero il documento, e — la parte che conta — che la famiglia resti
 * scritta dov'era.
 *
 * Perché su `data-theme` poggiano centinaia di regole del foglio storico: una
 * tavolozza che ci si scrivesse dentro le perderebbe tutte in un colpo, e
 * mezzo schermo resterebbe vestito da ieri. La tavolozza si scrive accanto,
 * non al posto.
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
  visibility: { home: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-config")?.classList.add("active");
  });
  await expect(page.locator("#theme-seg")).toBeAttached({ timeout: 15_000 });
}

const vestito = (page) =>
  page.evaluate(() => ({
    famiglia: document.documentElement.getAttribute("data-theme"),
    tavolozza: document.documentElement.getAttribute("data-dm-tavolozza"),
    fondo: getComputedStyle(document.documentElement).getPropertyValue("--bg-sculpted").trim(),
    testo: getComputedStyle(document.documentElement).getPropertyValue("--text").trim(),
  }));

test("i tasti delle tavolozze stanno sotto i tre di sempre", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const tasti = page.locator("[data-dm-tavolozza-opt]");
  await expect(tasti).toHaveCount(6);
  await expect(page.locator('[data-dm-tavolozza-opt="notte"]')).toContainText("Notte blu");
});

test("scegliere una tavolozza veste il documento senza toccare la famiglia", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const prima = await vestito(page);
  expect(prima.tavolozza).toBeNull();

  await page.locator('[data-dm-tavolozza-opt="notte"]').click();
  const notte = await vestito(page);
  expect(notte.tavolozza).toBe("notte");
  /* La famiglia c'è ancora, ed è quella della tavolozza: le regole dello scuro
   * continuano ad applicarsi. */
  expect(notte.famiglia).toBe("dark");
  expect(notte.fondo).toBe("#070d1c");

  /* Una tavolozza chiara porta con sé la sua famiglia. */
  await page.locator('[data-dm-tavolozza-opt="sabbia"]').click();
  const sabbia = await vestito(page);
  expect(sabbia.tavolozza).toBe("sabbia");
  expect(sabbia.famiglia).toBe("light");
  expect(sabbia.fondo).toBe("#f5efe4");
});

test("i tre tasti di sempre spengono la tavolozza", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('[data-dm-tavolozza-opt="bosco"]').click();
  expect((await vestito(page)).tavolozza).toBe("bosco");

  /* Chi sceglie «Scuro» vuole quello di serie: lasciargli il bosco addosso
   * sarebbe non rispondere al dito. */
  await page.locator('.theme-opt[data-theme="dark"]').click();
  const dopo = await vestito(page);
  expect(dopo.tavolozza).toBeNull();
  expect(dopo.famiglia).toBe("dark");
});

test("la tavolozza scelta resta al ricaricamento", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('[data-dm-tavolozza-opt="grafite"]').click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-dm-tavolozza", "grafite", {
    timeout: 15_000,
  });
});

/* «Nel tema Graphite, non cambia la barra» (#495).
 *
 * Ogni altra barra della plancia legge i token della tavolozza — la testata
 * col meteo, l'intestazione delle pagine. La barra in fondo no: il suo fondo
 * lo fissa il foglio storico, con i numeri scritti dentro e un !important
 * addosso, e con un selettore più specifico di quelli dei moduli. Vince lui, e
 * con il Grafite scelto si vedeva tutta la plancia sul grigio e la barra
 * ancora sullo slate bluastro di serie.
 *
 * Qui si tengono ferme due cose insieme, e la seconda conta quanto la prima:
 * con una tavolozza la barra la segue, e SENZA tavolozza non cambia un pixel —
 * chi tiene il tema scuro di sempre non ha chiesto niente.
 */
test("la barra in fondo segue la tavolozza, e senza tavolozza resta com'era", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const barra = () =>
    page.evaluate(() => {
      const nodo = document.querySelector("nav.tabs.bottom-nav-bar");
      const stile = getComputedStyle(nodo);
      return { sfondo: stile.backgroundColor, bordo: stile.borderColor };
    });
  const vesti = (chiave, famiglia) =>
    page.evaluate(
      ({ chiave, famiglia }) => {
        if (chiave) document.documentElement.setAttribute("data-dm-tavolozza", chiave);
        else document.documentElement.removeAttribute("data-dm-tavolozza");
        document.documentElement.setAttribute("data-theme", famiglia);
      },
      { chiave, famiglia },
    );

  /* Il metro: com'è senza tavolozza, scuro e chiaro. Questi due non devono
   * muoversi mai — sono la plancia di chi non ha scelto nulla. */
  await vesti("", "dark");
  const scuroDiSerie = await barra();
  expect(scuroDiSerie.sfondo).toBe("rgba(15, 23, 42, 0.92)");
  await vesti("", "light");
  const chiaroDiSerie = await barra();
  expect(chiaroDiSerie.sfondo).toBe("rgba(255, 255, 255, 0.92)");

  /* Grafite: grigio, non blu. */
  await vesti("grafite", "dark");
  const grafite = await barra();
  expect(grafite.sfondo, "la barra è rimasta sul blu di serie").not.toBe(scuroDiSerie.sfondo);
  expect(grafite.sfondo).toBe("rgba(28, 28, 31, 0.88)");
  expect(grafite.bordo).toBe("rgb(46, 46, 51)");

  /* E vale anche per le tavolozze chiare: non è una correzione per una sola. */
  await vesti("sabbia", "light");
  const sabbia = await barra();
  expect(sabbia.sfondo).not.toBe(chiaroDiSerie.sfondo);
  expect(sabbia.sfondo).toBe("rgba(255, 253, 248, 0.85)");

  /* Tolta la tavolozza si torna esattamente da dove si era partiti: le regole
   * nuove vivono solo finché l'attributo c'è. */
  await vesti("", "dark");
  expect(await barra()).toEqual(scuroDiSerie);
});

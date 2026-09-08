/* «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 * mischiate in sezioni che non c'entrano nulla.»
 *
 * Qui si guarda il Config vero: le linguette in ordine di famiglia, l'insegna
 * davanti a ogni gruppo, e la fila delle famiglie sopra che porta dove si
 * vuole andare. E soprattutto la cosa che non deve succedere: nessuna
 * linguetta sparisce, perché una linguetta che non si può premere è una scheda
 * che non si può aprire.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => window.apriConfigEntita?.());
  /* Le quattordici linguette dei moduli arrivano dopo il primo disegno: si
   * aspetta che ci siano tutte, non un numero fisso di millisecondi. */
  await expect(page.locator('#editor-modal .ed-tab[data-tab="rifiuti"]')).toHaveCount(1);
  await expect(
    page.locator("#dm-alberatura-famiglie .dm-alberatura-famiglia").first(),
  ).toBeVisible();
}

/** Le linguette come stanno adesso, nell'ordine del documento. */
function linguette(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#editor-modal .ed-tabs > .ed-tab")].map((n) => n.dataset.tab),
  );
}

test("le linguette stanno in ordine di famiglia, e nessuna si perde", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  const ordine = await linguette(page);
  /* Nessun doppione e niente di vuoto: riordinare non è duplicare. */
  expect(new Set(ordine).size).toBe(ordine.length);
  expect(ordine.filter(Boolean).length).toBe(ordine.length);

  /* Le tre che stavano peggio, adesso ognuna coi suoi. La prova non elenca
   * tutte e trentadue — quello lo fa la prova del modello — ma controlla che
   * il gruppo si veda dove deve. */
  const posto = (id) => ordine.indexOf(id);
  expect(posto("visib")).toBe(0);
  /* Energia sta fra la plancia e il clima. */
  expect(posto("sez1")).toBeGreaterThan(posto("runtime"));
  expect(posto("sez1")).toBeLessThan(posto("sez9"));
  /* Rifiuti non sta più fra il backup e i varchi: sta con gli avvisi. */
  expect(posto("rifiuti")).toBeGreaterThan(posto("avvisi"));
  expect(posto("rifiuti")).toBeLessThan(posto("sez6"));
  /* E il server è l'ultimo: è l'unica cosa che non parla della casa. */
  expect(posto("sez6")).toBe(ordine.length - 1);
});

test("ogni famiglia ha la sua insegna, davanti al suo gruppo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const insegne = await page.evaluate(() =>
    [...document.querySelectorAll("#editor-modal .ed-tabs > .dm-alberatura-insegna")].map(
      (n) => n.dataset.famiglia,
    ),
  );
  expect(insegne).toEqual([
    "plancia",
    "energia",
    "clima",
    "casa",
    "sicurezza",
    "avvisi",
    "macchine",
  ]);
  /* L'insegna non è una linguetta: non ha `data-tab`, quindi chi cerca una
   * scheda per identificativo non la trova. */
  await expect(page.locator("#editor-modal .dm-alberatura-insegna[data-tab]")).toHaveCount(0);
});

test("nessuna linguetta si nasconde: si possono ancora premere tutte", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const ordine = await linguette(page);
  /* È la promessa su cui poggia tutto il resto del progetto: una quarantina di
   * prove aprono una scheda cliccandola. Se una linguetta diventa invisibile,
   * quelle cadono tutte insieme. */
  for (const id of ordine)
    await expect(page.locator(`#editor-modal .ed-tab[data-tab="${id}"]`)).toBeVisible();
});

test("la fila delle famiglie non finisce sotto la colonna delle linguette", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Il Config è una griglia con le caselle scritte a mano, e una fila infilata
   * senza dirle dove andare si piazza da sola: finiva SOPRA la colonna delle
   * linguette. Su uno schermo largo si vedeva lo stesso e sembrava a posto; su
   * un telefono quella colonna è larga 46 pixel, e la fila ci spariva sotto —
   * visibile, e impossibile da premere.
   *
   * Che si possa premere lo prova la prova qui sotto. Questa dice PERCHÉ,
   * perché una prova che scade dopo due minuti non racconta niente. */
  const sovrapposte = await page.evaluate(() => {
    const fila = document.getElementById("dm-alberatura-famiglie");
    const linguette = document.querySelector("#editor-modal .ed-tabs");
    if (!fila || !linguette) return null;
    const a = fila.getBoundingClientRect();
    const b = linguette.getBoundingClientRect();
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  });
  expect(sovrapposte).toBe(false);
});

test("la fila delle famiglie porta dove dice, e si accende su quella giusta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  await page.locator('#dm-alberatura-famiglie [data-dm-famiglia="sicurezza"]').click();
  /* La prima scheda della famiglia, e l'insegna accesa. */
  await expect(page.locator('#editor-modal .ed-tab[data-tab="sez4"]')).toHaveClass(/active/);
  await expect(page.locator('#dm-alberatura-famiglie [data-dm-famiglia="sicurezza"]')).toHaveClass(
    /active/,
  );

  /* Ritoccando la stessa famiglia non si perde il posto: chi tocca «Casa»
   * mentre configura le Luci vuole vedere dov'è, non ricominciare. */
  await page.evaluate(() => window.editorSwitch?.("luci"));
  await expect(page.locator('#dm-alberatura-famiglie [data-dm-famiglia="casa"]')).toHaveClass(
    /active/,
  );
  await page.locator('#dm-alberatura-famiglie [data-dm-famiglia="casa"]').click();
  await expect(page.locator('#editor-modal .ed-tab[data-tab="luci"]')).toHaveClass(/active/);
});

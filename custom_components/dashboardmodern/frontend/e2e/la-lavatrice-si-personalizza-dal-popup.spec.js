/* Il popup della lavatrice si personalizza da dentro.
 *
 * Dal campo: «manca la possibilita' di personalizzare il popup azione rapida
 * lavatrice» — la carta dei programmi viveva solo nella fisarmonica della
 * mappatura, e senza programmi la griglia spariva: il popup non suggeriva
 * nemmeno che i tasti esistono. Ora un ⚙️ ripiegato apre la stessa carta nel
 * popup, e un programma scritto li' compare subito fra i tasti rapidi.
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

test("il ⚙️ nel popup scrive un programma e il tasto compare", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  const piega = page.locator("#lavatrice-modal [data-dm-lav-popup-editor]");
  await expect(piega).toBeAttached({ timeout: 20000 });

  await page.evaluate(() => {
    const piega = document.querySelector("#lavatrice-modal [data-dm-lav-popup-editor]");
    piega.open = true;
    piega.querySelector(".dm-lav-aggiungi").click();
  });
  await page.evaluate(() => {
    const riga = document.querySelector(
      "#lavatrice-modal [data-dm-lav-popup-editor] .dm-lav-riga:last-child",
    );
    riga.querySelector(".dm-lav-nome").value = "Rapido 30'";
    riga.querySelector(".dm-lav-entita").value = "script.lavatrice_rapido";
    riga.querySelector(".dm-lav-entita").dispatchEvent(new Event("change", { bubbles: true }));
  });
  /* Il salvataggio e' immediato e il tasto rapido compare subito. */
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          JSON.parse(window.localStorage.getItem("cd_lavatrice_programmi") || "[]"),
        ),
      { timeout: 10000 },
    )
    .toHaveLength(1);
  await expect(
    page.locator(
      '#lavatrice-modal .lav-preset-grid [data-dm-lav-programma="script.lavatrice_rapido"]',
    ),
  ).toBeAttached({ timeout: 10000 });
});

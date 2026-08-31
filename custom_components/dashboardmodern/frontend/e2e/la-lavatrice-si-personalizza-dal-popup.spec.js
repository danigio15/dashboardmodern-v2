/* La configurazione del popup Lavatrice esce nelle Azioni rapide.
 *
 * Dal campo: «il config non lo devi mettere nel popup ma nella sezione azioni
 * rapide: quando si sceglie popup lavatrice esce la configurazione completa».
 * Col menu dell'azione su «🧺 Popup Lavatrice» compare la carta intera dei
 * programmi — nome, entita', icona — col salvataggio a ogni modifica e i
 * tasti che compaiono subito nel popup; scelta un'altra azione, si ritira.
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

test("scelto Popup Lavatrice esce la carta, scritta si vede nel popup", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  /* Le Azioni rapide vivono in una delle schede-sezione: si gira finche'
   * non compare il loro menu. */
  /* Le Azioni rapide vivono in una scheda-sezione (sui gusci di prova la
   * sez8): si gira finche' il menu non c'e' ANCORA dopo l'assestamento dei
   * decoratori, poi si sceglie Popup Lavatrice. */
  let schedaAzioni = "";
  for (const scheda of ["sez8", "sez0", "sez1", "sez2", "sez3", "sez4", "sez6", "sez7", "sez9"]) {
    await page.evaluate((t) => {
      try {
        window.editorSwitch?.(t);
      } catch (_e) {}
    }, scheda);
    await page.waitForTimeout(900);
    if (await page.evaluate(() => Boolean(document.getElementById("ed-qa-type")))) {
      schedaAzioni = scheda;
      break;
    }
  }
  expect(schedaAzioni).not.toBe("");
  await page.evaluate(() => {
    const menu = document.getElementById("ed-qa-type");
    menu.value = "builtin_lavatrice";
    menu.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#ed-body [data-dm-lav-programmi]")).toBeAttached({ timeout: 10000 });

  /* Nel popup NON c'e' piu' il ⚙️. */
  await expect(page.locator("#lavatrice-modal [data-dm-lav-popup-editor]")).toHaveCount(0);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const carta = document.querySelector("#ed-body [data-dm-lav-programmi]");
          if (!carta) return false;
          carta.querySelector(".dm-lav-aggiungi").click();
          const riga = carta.querySelector(".dm-lav-riga:last-child");
          riga.querySelector(".dm-lav-nome").value = "Rapido 30'";
          riga.querySelector(".dm-lav-entita").value = "script.lavatrice_rapido";
          riga
            .querySelector(".dm-lav-entita")
            .dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }),
      { timeout: 15000 },
    )
    .toBe(true);
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

  /* «Non si possono configurare le altre cose presenti nel popup»: la carta
   * porta anche le caselle della finestra, e scriverne una la salva negli
   * stessi override del guscio. */
  await expect(
    page.locator('#ed-body .dm-lav-slot-in[data-ref="dm.lavatrice_fase_corrente"]'),
  ).toBeAttached({ timeout: 10000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const campo = document.querySelector(
            '#ed-body .dm-lav-slot-in[data-ref="dm.lavatrice_tempo_rimanente"]',
          );
          if (!campo) return "campo-assente";
          campo.value = "sensor.lavatrice_tempo";
          campo.dispatchEvent(new Event("change", { bubbles: true }));
          const dati = JSON.parse(window.localStorage.getItem("cd_entity_overrides") || "{}");
          return dati["dm.lavatrice_tempo_rimanente"] || "";
        }),
      { timeout: 15000 },
    )
    .toBe("sensor.lavatrice_tempo");
  /* E i programmi gia' scritti restano dov'erano: le caselle non passano da
   * `raccogli`, quindi non si portano via la lista. */
  expect(
    await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("cd_lavatrice_programmi") || "[]"),
    ),
  ).toHaveLength(1);

  /* Scelta un'altra azione, la carta si ritira. */
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const menu = document.getElementById("ed-qa-type");
          if (!menu) return "menu-sparito";
          menu.value = "toggle";
          menu.dispatchEvent(new Event("change", { bubbles: true }));
          return document.querySelectorAll("#ed-body [data-dm-lav-programmi]").length;
        }),
      { timeout: 15000 },
    )
    .toBe(0);
});

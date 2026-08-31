/* Il «Salva sezione» delle Aperture salva TUTTE le porte, non solo la prima.
 *
 * Dal campo: «aggiunge altre porte ma lo switch esce solo sulla prima, e le
 * altre aperture non compaiono in Sicurezza». Il tasto verde premeva i
 * salvataggi nascosti riga per riga; il primo valido ridisegnava l'editor e i
 * bottoni delle righe dopo restavano staccati dal documento — il gestore
 * delegato li ignorava, e l'entita' appena scelta si perdeva. Ora il gesto
 * legge tutte le righe e scrive una volta; la riga aggiunta e mai compilata
 * non resta in giro come «Porta 2» fantasma.
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
  visibility: { home: true, security: true },
};

test("tre porte compilate, un gesto solo, tre porte salvate", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    /* La prima porta e' gia' salvata e valida: e' LEI che, col vecchio giro,
     * ridisegnava l'editor e staccava i bottoni delle righe dopo. */
    window.localStorage.setItem(
      "cd_security_doors",
      JSON.stringify([
        { id: "door-uno", name: "Portoncino", entity: "lock.portoncino", icon: "🚪", pin: "" },
      ]),
    );
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-add]")).toBeAttached({ timeout: 20000 });

  /* Due porte nuove compilate, piu' una lasciata vuota (il dito che aggiunge
   * e poi ci ripensa). */
  await page.locator("[data-door-add]").click();
  await page.locator("[data-door-add]").click();
  await page.locator("[data-door-add]").click();
  await page.evaluate(() => {
    const compila = (indice, nome, entita) => {
      document.getElementById(`dm-door-${indice}-name`).value = nome;
      const campo = document.getElementById(`dm-door-${indice}-entity`);
      campo.value = entita;
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    };
    compila(1, "Cancello", "switch.cancello");
    compila(2, "Garage", "cover.garage");
  });
  await page.locator(".dm-save-footer-btn").click();
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          JSON.parse(window.localStorage.getItem("cd_security_doors") || "[]").map(
            (porta) => porta.entity,
          ),
        ),
      { timeout: 10000 },
    )
    .toEqual(["lock.portoncino", "switch.cancello", "cover.garage"]);
  /* La riga fantasma non c'e' piu', ne' in configurazione ne' a schermo. */
  expect(
    await page.evaluate(
      () => JSON.parse(window.localStorage.getItem("cd_security_doors") || "[]").length,
    ),
  ).toBe(3);
});

test("la porta a meta' resta scritta, aperta e con l'errore in vista", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-add]")).toBeAttached({ timeout: 20000 });
  await page.locator("[data-door-add]").click();
  await page.evaluate(() => {
    document.getElementById("dm-door-0-name").value = "Portone condominio";
  });
  await page.locator(".dm-save-footer-btn").click();
  /* Il nome battuto non si perde, la riga chiede l'entita'. */
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => JSON.parse(window.localStorage.getItem("cd_security_doors") || "[]")[0]?.name,
        ),
      { timeout: 10000 },
    )
    .toBe("Portone condominio");
  await expect(page.locator("[data-door-error]").first()).toContainText("entità", {
    timeout: 10000,
  });
  expect(await page.locator(".dm-door-ed-body:not([hidden])").count()).toBe(1);
});

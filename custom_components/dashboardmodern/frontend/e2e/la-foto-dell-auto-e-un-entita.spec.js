import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Sarebbe utile avere anche la possibilità di specificare l'immagine dell'auto
 * come entità immagine da selezionare al posto del path del file locale. Alcune
 * integrazioni come UConnect mettono a disposizione questa entità.» (#369)
 *
 * Qui si prova la strada intera: si scrive l'entità nel campo della foto, si
 * salva, e la plancia mostra la foto che Home Assistant pubblica per quella
 * entità. E quello che resta scritto in configurazione è l'ENTITÀ, non
 * l'indirizzo che aveva oggi: e' quello il legame con l'integrazione.
 */
const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "ev-uno", name: "Prima", brand: "Leapmotor", icon: "mdi:car-electric" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true },
};

const STATI = [
  {
    entity_id: "image.uconnect_auto",
    state: "2026-09-07T10:00:00+00:00",
    attributes: { entity_picture: "/api/image_proxy/image.uconnect_auto?token=abc" },
  },
];

async function apriLaSchedaAuto(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate(
    (haStati) =>
      haStati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }),
    STATI,
  );
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
}

test("l'entità immagine si scrive nel campo, e la foto è quella che pubblica", async ({
  page,
}, testInfo) => {
  await apriLaSchedaAuto(page, testInfo);

  const campo = page.locator('[data-ev-photo="idle"] [data-ev-photo-input]');
  await expect(campo).toHaveCount(1);
  /* La casella resta una casella: accetta anche un percorso, quindi non si
   * veste da pastiglia — con la pastiglia addosso il percorso non si potrebbe
   * piu' battere. */
  await expect(campo).toBeVisible();
  await campo.fill("image.uconnect_auto");
  await page
    .locator("#ed-body [data-ev-photos] [data-ev-photos-save]")
    .evaluate((bottone) => bottone.click());

  // In configurazione resta l'ENTITA': e' il legame con l'integrazione.
  await expect
    .poll(() =>
      page.evaluate(() => {
        /* Il guscio intesta la memoria alla sessione da solo: si chiede la
         * casella col suo nome, come fa lui. */
        const grezzo = window.localStorage.getItem("cd_ev_image");
        try {
          return JSON.parse(grezzo);
        } catch (_errore) {
          return grezzo;
        }
      }),
    )
    .toBe("image.uconnect_auto");

  // E sulla plancia c'e' la foto vera, col gettone che Home Assistant ci mette.
  await expect
    .poll(() =>
      page.evaluate(() => document.getElementById("ev-mod-car-img")?.getAttribute("src") || ""),
    )
    .toBe("/api/image_proxy/image.uconnect_auto?token=abc");
});

test("la lente accanto al campo apre il catalogo delle entità", async ({ page }, testInfo) => {
  await apriLaSchedaAuto(page, testInfo);

  const lente = page.locator('[data-ev-photo="idle"] [data-ev-photo-pick]');
  await expect(lente).toHaveCount(1);
  await lente.scrollIntoViewIfNeeded();
  await lente.click();
  await expect(page.locator("#cd-entpick")).toHaveCount(1);
});

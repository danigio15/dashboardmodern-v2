import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* «Vorrei che ci fosse la possibilità di un menu a tendina per le 2 settimane
 * così uno sceglie il rifiuto, senza dover creare o modificare il calendario di
 * home assistant.» (#366)
 *
 * La strada intera, e senza nessuna entità: si apre la scheda Rifiuti, si tocca
 * un giorno, si sceglie il bidone, si salva — e la pagina lo dice.
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
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, rifiuti: true },
};

async function apriLaScheda(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate(() => window.apriConfigEntita());
  // La linguetta Rifiuti la mette un modulo: si aspetta lei, e poi si tocca
  // come la toccherebbe una persona.
  await page.locator('.ed-tab[data-tab="rifiuti"]').click();
  await page.waitForSelector("#ed-body .dm-turno-griglia");
}

test("un giorno si tocca, il bidone si sceglie, e la pagina lo dice", async ({
  page,
}, testInfo) => {
  await apriLaScheda(page, testInfo);

  // Quattordici caselle: due settimane, come il foglietto sul frigo.
  await expect(page.locator("#ed-body [data-dm-turno-giorno]")).toHaveCount(14);

  /* Il turno parte dal lunedì di questa settimana, quindi «domani» è la casella
   * di domani: la si calcola invece di fissarla, o la prova varrebbe un giorno
   * solo alla settimana. */
  const domani = await page.evaluate(() => {
    const oggi = new Date();
    return ((oggi.getDay() + 6) % 7) + 1;
  });
  if (domani > 13) return; // domenica: il turno di domani è nella settimana dopo
  await page.locator(`#ed-body [data-dm-turno-giorno="${domani}"]`).click();

  const tendina = page.locator("#dm-rifiuti-turno");
  await expect(tendina).toBeVisible();
  await tendina.locator('[data-dm-turno-voce="carta"]').click();
  await tendina.locator(".dm-turno-fatto").click();
  await expect(tendina).toHaveCount(0);

  // La casella se lo porta scritto, prima ancora di salvare.
  await expect(page.locator(`#ed-body [data-dm-turno-giorno="${domani}"]`)).toContainText("📦");

  await page.locator("#ed-body [data-dm-rifiuti-save]").evaluate((bottone) => bottone.click());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const grezzo = window.localStorage.getItem("cd_rifiuti");
        try {
          return (
            JSON.parse(grezzo)
              ?.turno?.giorni?.filter((g) => g.length)
              .flat() || []
          );
        } catch (_errore) {
          return [];
        }
      }),
    )
    .toEqual(["carta"]);

  // E la pagina risponde alla domanda della sera, senza nessuna entità.
  await page.evaluate(() => {
    document.querySelectorAll("#editor-modal,.ed-shell").forEach((nodo) => nodo.remove());
  });
  await clickBottomTab(page, "rifiuti", testInfo);
  await expect(page.locator("#page-rifiuti")).toContainText(/Carta/i);
});

test("senza data d'inizio il turno non si inventa niente", async ({ page }, testInfo) => {
  await apriLaScheda(page, testInfo);
  // La data parte compilata col lunedì di questa settimana: è l'inizio giusto
  // per quasi tutti, e senza una data il turno non si potrebbe collocare.
  await expect(page.locator("#ed-body [data-dm-turno-inizio]")).not.toHaveValue("");
});

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

test("con le sole due settimane la tessera c'e' anche in Home", async ({ page }, testInfo) => {
  /* Il turno scritto a mano non ha nessuna entita': e' il foglietto sul frigo.
   * Il cancello della tessera in Home pretendeva almeno un'entita' non esclusa
   * dai widget, e con l'elenco vuoto non passava — quindi chi configurava SOLO
   * le due settimane, cioe' esattamente chi quel turno l'ha chiesto, si
   * ritrovava la sezione piena e in Home niente. */
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Le tessere della Home escono solo su una plancia configurata: una luce
   * basta, ed e' quello che ha chiunque abbia qualcosa da vedere in Home. */
  const conUnaLuce = {
    ...seed,
    sections: { ...seed.sections, lights: [{ entity: "light.salotto", name: "Salotto" }] },
  };
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, conUnaLuce);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.evaluate(() => {
    const oggi = new Date();
    const due = (n) => String(n).padStart(2, "0");
    const inizio = `${oggi.getFullYear()}-${due(oggi.getMonth() + 1)}-${due(oggi.getDate())}`;
    const giorni = Array.from({ length: 14 }, () => []);
    giorni[0] = ["carta"];
    window.localStorage.setItem("cd_rifiuti", JSON.stringify({ turno: { inizio, giorni } }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  });

  const tessera = page.locator('.dm-tile[data-dm-widget="rifiuti"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText(/Carta/i);
});

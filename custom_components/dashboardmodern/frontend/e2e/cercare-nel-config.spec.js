/* «Implementa una funzione cerca che possa cercare all'interno di tutto il
 * config quella parola, cosi' da velocizzare le modifiche e le
 * configurazioni.»
 *
 * Le schede della configurazione sono venti e ognuna si disegna solo quando la
 * si apre. Questa prova fissa le tre cose che fanno di una ricerca una
 * scorciatoia vera: che la riga ci sia appena si apre la configurazione, che
 * trovi una parola scritta in una scheda CHIUSA — cioe' che non stia cercando
 * nel disegno — e che il risultato porti davvero su quella scheda.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:silverware-fork-knife" }],
    cameras: [],
    appliances: [
      {
        id: "app-lavastoviglie",
        name: "Lavastoviglie di casa",
        device_type: "lavastoviglie",
        room_id: "room-cucina",
        entities: ["sensor.lavastoviglie_energia"],
      },
    ],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

async function apriLaConfigurazione(page) {
  await page.evaluate(() => {
    globalThis.apriConfigEntita?.();
    globalThis.editorSwitch?.("visib");
  });
}

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await apriLaConfigurazione(page);
}

test("la riga per cercare c'e' appena si apre la configurazione", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const campo = page.locator(".dm-cerca-config-in");
  await expect(campo).toBeVisible();
  /* Prima di scrivere non c'e' un elenco: la barra non ruba spazio a chi non
   * sta cercando. */
  await expect(page.locator(".dm-cerca-config-esiti")).toBeHidden();
});

test("trova una parola scritta in una scheda che non e' aperta", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  /* Si sta guardando Impostazioni: l'elettrodomestico sta in un'altra scheda,
   * che non e' mai stata disegnata. Se la ricerca guardasse il documento non
   * lo troverebbe. */
  await page.locator(".dm-cerca-config-in").fill("lavastoviglie");
  const esiti = page.locator(".dm-cerca-config-esito");
  await expect(esiti.first()).toBeVisible();
  await expect(esiti.first()).toContainText(/Lavastoviglie di casa/i);
  /* E dice da quale scheda viene, col nome che si legge sulla linguetta. */
  await expect(esiti.first().locator(".dm-cerca-config-dove")).toContainText(/Elettrodom/i);
});

test("il risultato porta sulla scheda giusta", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.locator(".dm-cerca-config-in").fill("lavastoviglie");
  await page.locator(".dm-cerca-config-esito").first().click();
  await expect(page.locator('.ed-tab[data-tab="appliances"]')).toHaveClass(/active/);
  /* Cambiare scheda non porta via quello che si stava cercando: il guscio
   * ridisegna il corpo, la barra sta sopra. */
  await expect(page.locator(".dm-cerca-config-in")).toHaveValue("lavastoviglie");
});

test("una parola che non c'e' lo dice, e Pulisci rimette a posto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const campo = page.locator(".dm-cerca-config-in");
  await campo.fill("zzzznonesiste");
  await expect(page.locator(".dm-cerca-config-vuoto")).toBeVisible();
  await page.locator(".dm-cerca-config-via").click();
  await expect(campo).toHaveValue("");
  await expect(page.locator(".dm-cerca-config-esiti")).toBeHidden();
});

/* La tessera delle Porte, in Home, dentro un browser vero (#457).
 *
 * «Create a doors widget in the home, separate from the security widget.»
 *
 * Le prove a tavolino dicono che il modello è giusto e che nessuna scelta si
 * perde nel passaggio. Quello che non possono dire è se in Home si vedono due
 * tessere invece di una, e se il tasto che apre il portone apre ancora. Quelle
 * due cose si guardano soltanto qui.
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

const PORTE = [
  { id: "portone", name: "Portone", entity: "lock.portone", icon: "🚪" },
  { id: "cancello", name: "Cancello", entity: "switch.cancello", icon: "🚧" },
];

const STATI = {
  "lock.portone": {
    entity_id: "lock.portone",
    state: "locked",
    attributes: { friendly_name: "Portone" },
  },
  "switch.cancello": {
    entity_id: "switch.cancello",
    state: "off",
    attributes: { friendly_name: "Cancello" },
  },
  /* La centrale si guarda dal riferimento della plancia, non dall'entità: è
   * quello che legge anche la pagina Sicurezza. */
  "dm.security_centrale_allarme": {
    entity_id: "dm.security_centrale_allarme",
    state: "disarmed",
    attributes: { friendly_name: "Antifurto", supported_features: 3 },
  },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((porte) => {
    window.localStorage.setItem("cd_security_doors", JSON.stringify(porte));
  }, PORTE);
  await conStati(page, STATI);
}

async function conStati(page, valori) {
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, valori);
}

test("le porte hanno una tessera loro, accanto alla Sicurezza", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const porte = page.locator('.dm-tile[data-dm-widget="porte"]').first();
  await expect(porte).toBeVisible({ timeout: 20_000 });
  /* «Apri porte» dice cosa fa, non cosa sorveglia (#513): e' il nome della
     pagina che questa tessera apre. */
  await expect(porte).toContainText("Apri porte");
  /* Il disegno è il nostro, non un'emoji del sistema. */
  await expect(porte.locator("svg.dm-oggetto")).toBeAttached();

  /* E la Sicurezza è rimasta al suo posto: la divisione non l'ha portata via. */
  await expect(page.locator('.dm-tile[data-dm-widget="sicurezza"]').first()).toBeVisible();
});

test("una serratura sbloccata si vede dalla Home senza aprire niente", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const porte = page.locator('.dm-tile[data-dm-widget="porte"]').first();
  await expect(porte).toBeVisible({ timeout: 20_000 });
  /* A casa chiusa il numero è zero e la tessera non allarma nessuno. */
  await expect(porte).toContainText("Tutto chiuso");

  await conStati(page, {
    "lock.portone": {
      entity_id: "lock.portone",
      state: "unlocked",
      attributes: { friendly_name: "Portone" },
    },
  });
  /* Adesso il numero grande è uno, e la didascalia dice quale: «una aperta»
   * senza sapere quale obbliga ad aprire la scheda per una domanda che si fa
   * in mezzo secondo. */
  await expect(porte).toContainText("Portone");
});

test("il tasto che apre è dentro le Porte, e non è rimasto anche nella Sicurezza", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  await page.locator('.dm-tile[data-dm-widget="porte"]').first().click();
  const popup = page.locator("#dm-widget-popup");
  await expect(popup).toBeVisible({ timeout: 10_000 });
  /* Una riga per apertura, e il tasto che le apre: è lo stesso `data-dm-door`
   * della pagina Sicurezza, quindi conferma e PIN restano una mano sola. */
  await expect(popup.locator("[data-dm-door]")).toHaveCount(2);
  await expect(popup).toContainText("Portone");
  await expect(popup).toContainText("Cancello");

  await page.keyboard.press("Escape");
  await page.locator('.dm-tile[data-dm-widget="sicurezza"]').first().click();
  await expect(popup).toBeVisible({ timeout: 10_000 });
  /* Qui dentro le porte non ci sono più: due tasti per lo stesso gesto sono
   * due cose che possono divergere. */
  await expect(popup.locator("[data-dm-door]")).toHaveCount(0);
  await expect(popup).toContainText("Antifurto");
});

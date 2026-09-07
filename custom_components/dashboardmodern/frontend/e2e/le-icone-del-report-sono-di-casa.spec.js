/* «Le icone dei dispositivi nella sezione Report Analisi energia non sono del
 * nostro catalogo.»
 *
 * Non erano scelte male: erano dentro un `<option>`, e un `<option>` non puo'
 * contenere niente di disegnato. Quella lista la disegnava il telefono, e
 * dentro ci stava l'unica cosa che ci puo' stare — il carattere grezzo. Cosi'
 * lo stesso apparecchio portava l'icona vestita di casa dappertutto e un'emoji
 * nuda li'.
 *
 * Questa prova fissa due cose. La prima e' che la scelta continua a funzionare
 * esattamente come prima: il `<select>` resta il padrone del valore — lo legge
 * il guscio storico, e sul suo `change` ricarica il dettaglio — e il tasto
 * disegnato gli scrive dentro. La seconda e' che la faccia di ogni voce e'
 * quella di casa: non basta ridisegnare l'emoji che il guscio ha gia'
 * schiacciato dentro l'opzione, perche' quella tornerebbe un'emoji.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STATI = [
  {
    entity_id: "sensor.lavastoviglie_energia",
    state: "12.5",
    attributes: {
      friendly_name: "Lavastoviglie energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.wallbox_energia",
    state: "1440.762",
    attributes: {
      friendly_name: "Wallbox energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    /* Un elettrodomestico col suo disegno di casa e un carico con la sua icona
     * di catalogo: le due strade da cui il Report prende le sue voci. */
    appliances: [
      {
        id: "app-lavastoviglie",
        name: "Lavastoviglie",
        device_type: "lavastoviglie",
        visual_key: "lavastoviglie",
        total_energy_entity: "sensor.lavastoviglie_energia",
        entities: ["sensor.lavastoviglie_energia"],
      },
    ],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: [
      {
        id: "load-wallbox",
        name: "Wallbox",
        icon: "mdi:ev-station",
        total_energy_entity: "sensor.wallbox_energia",
        entities: ["sensor.wallbox_energia"],
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

async function apriIlReport(page) {
  /* La tendina del Report vive nell'editor: qui si ricrea la sua situazione —
   * il `<select>` con le opzioni che il guscio gli mette, emoji comprese —
   * senza dover navigare tutta la configurazione. */
  await page.evaluate((stati) => {
    /* Gli stati del guscio sono variabili lessicali, non roba di `window`:
     * si scrivono per nome, come fa ogni altra prova. */
    stati.forEach((voce) => {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    });
    document.getElementById("ed-dev-selector")?.closest(".dm-report-tendina-cornice")?.remove();
    document.getElementById("ed-dev-selector")?.remove();
    const casa = document.createElement("div");
    casa.id = "dm-prova-report";
    casa.innerHTML =
      '<select id="ed-dev-selector">' +
      '<option value="sensor.lavastoviglie_energia">🍽️ Lavastoviglie</option>' +
      '<option value="sensor.wallbox_energia">⚡ Wallbox</option>' +
      "</select>";
    document.body.append(casa);
    window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready", { detail: {} }));
  }, STATI);
}

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await apriIlReport(page);
}

test("la tendina del Report la disegna la plancia, non il telefono", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const tasto = page.locator(".dm-report-tendina");
  await expect(tasto).toBeVisible();
  await expect(tasto).toContainText("Lavastoviglie");

  /* Il `<select>` c'e' ancora ed e' ancora lui il valore: il guscio storico lo
   * legge per nome, e toglierlo vorrebbe dire rompere tutto quello che ci sta
   * sotto. */
  await expect(page.locator("#ed-dev-selector")).toHaveCount(1);
});

test("scegliere dal foglio scrive nel select e gli fa dire change", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  /* Il `change` e' quello su cui il guscio ricarica il dettaglio: si conta. */
  await page.evaluate(() => {
    window.__CAMBI = 0;
    document
      .getElementById("ed-dev-selector")
      .addEventListener("change", () => (window.__CAMBI += 1));
  });

  await page.locator(".dm-report-tendina").click();
  const foglio = page.locator("#dm-report-tendina-foglio");
  await expect(foglio).toBeVisible();
  await foglio.locator(".dm-report-tendina-voce", { hasText: "Wallbox" }).click();

  await expect(foglio).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById("ed-dev-selector").value)).toBe(
    "sensor.wallbox_energia",
  );
  expect(await page.evaluate(() => window.__CAMBI)).toBe(1);
  await expect(page.locator(".dm-report-tendina")).toContainText("Wallbox");
});

test("ogni voce porta il disegno di casa, non l'emoji dell'opzione", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.locator(".dm-report-tendina").click();

  /* Il disegno di casa e' un `<svg>`. L'emoji che sta nell'opzione — 🍽️, ⚡ —
   * il motore non la conosce e la ristamperebbe com'e': se una di queste
   * caselle contenesse ancora quel carattere, la faccia verrebbe di nuovo dal
   * telefono e non dal catalogo. */
  const icone = page.locator("#dm-report-tendina-foglio .dm-report-tendina-voce-icona");
  await expect(icone).toHaveCount(2);
  for (let indice = 0; indice < 2; indice += 1) {
    await expect(icone.nth(indice).locator("svg")).toHaveCount(1);
    await expect(icone.nth(indice)).not.toContainText(/[🍽⚡]/);
  }

  /* E il tasto chiuso porta la stessa faccia della riga che ha scelto. */
  await page.locator("#dm-report-tendina-foglio .dm-foglio-scelta-chiudi").click();
  await expect(page.locator(".dm-report-tendina .dm-report-tendina-icona svg")).toHaveCount(1);
});

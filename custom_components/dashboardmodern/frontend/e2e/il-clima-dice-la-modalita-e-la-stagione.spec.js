import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* Tre richieste sulla stessa scheda del Clima.
 *
 * #362 — «I termostati smart espongono una o più entità che indicano la
 * modalità del riscaldamento. Io ho TADO e due modalità HOME e AWAY.» La
 * pastiglia la mostra, e con un select la si cambia da lì.
 *
 * #365 — «Condizionatore solo maggio-settembre, termosifoni ottobre-aprile.»
 * Fuori stagione la card non c'è — ma un'unità ACCESA si vede sempre, o non la
 * si potrebbe più spegnere.
 */
const unita = (extra) => ({
  id: `cl-${extra.entity}`,
  type: "clima",
  ...extra,
});

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      unita({ name: "Salone", entity: "climate.salone", modo: "select.tado_casa" }),
      unita({ name: "Camera", entity: "climate.camera" }),
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

const STATI = [
  {
    entity_id: "climate.salone",
    state: "cool",
    attributes: { friendly_name: "Salone", temperature: 24, current_temperature: 27.4 },
  },
  {
    entity_id: "climate.camera",
    state: "off",
    attributes: { friendly_name: "Camera", temperature: 22, current_temperature: 25.1 },
  },
  {
    entity_id: "select.tado_casa",
    state: "AWAY",
    attributes: { friendly_name: "Tado", options: ["HOME", "AWAY"] },
  },
];

async function apriIlClima(page, testInfo, configurazione = seed) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, configurazione);
  await page.evaluate(
    (haStati) =>
      haStati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }),
    STATI,
  );
  // Le chiamate a Home Assistant si raccolgono invece di partire.
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE__.push([dominio, servizio, dati]);
      return Promise.resolve();
    };
  });
  await clickBottomTab(page, "clima", testInfo);
  await page.waitForSelector("#page-clima .dm-cl-card");
}

test("la pastiglia dice la modalità, e con un select la cambia", async ({ page }, testInfo) => {
  await apriIlClima(page, testInfo);

  const pastiglia = page.locator("#card-climate-salone [data-dm-cl-modo]");
  await expect(pastiglia).toBeVisible();
  await expect(pastiglia).toHaveText(/Fuori casa/);

  /* Due modalità sono un giro, non un menu: un elenco con due voci dentro è un
   * passaggio in più per niente. */
  await pastiglia.click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__))
    .toEqual([["select", "select_option", { entity_id: "select.tado_casa", option: "HOME" }]]);
});

test("l'unità senza entità della modalità non mostra una pastiglia vuota", async ({
  page,
}, testInfo) => {
  await apriIlClima(page, testInfo);
  const senza = page.locator("#card-climate-camera [data-dm-cl-modo]");
  await expect(senza).toHaveCount(1);
  await expect(senza).toBeHidden();
});

test("fuori stagione la card non c'è, ma se è accesa si vede lo stesso", async ({
  page,
}, testInfo) => {
  /* I mesi si scelgono attorno a oggi: la prova non deve aspettare ottobre. */
  const mese = new Date().getMonth() + 1;
  const altro = mese === 12 ? 6 : mese + 1;
  const stagionale = structuredClone(seed);
  // Il Salone è ACCESO e fuori stagione: si vede lo stesso.
  stagionale.sections.climate[0].mesi = [altro];
  // La Camera è SPENTA e fuori stagione: sparisce.
  stagionale.sections.climate[1].mesi = [altro];

  await apriIlClima(page, testInfo, stagionale);
  await expect(page.locator("#card-climate-salone")).toHaveCount(1);
  await expect(page.locator("#card-climate-camera")).toHaveCount(0);
  // E chi è sparito viene detto, o sembra configurazione persa.
  await expect(page.locator("#page-clima [data-dm-cl-fuori]")).toContainText(/1/);
});

test("con tutti i mesi accesi non sparisce niente", async ({ page }, testInfo) => {
  const sempre = structuredClone(seed);
  sempre.sections.climate[0].mesi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  sempre.sections.climate[1].mesi = [];
  await apriIlClima(page, testInfo, sempre);
  await expect(page.locator("#page-clima .dm-cl-card")).toHaveCount(2);
  await expect(page.locator("#page-clima [data-dm-cl-fuori]")).toBeHidden();
});

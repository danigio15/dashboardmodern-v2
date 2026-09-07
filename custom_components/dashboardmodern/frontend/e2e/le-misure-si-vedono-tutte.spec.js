/* «Quando si apre la scheda batterie, oltre a mostrare quelle più scariche, ci
 * fosse un tasto mostra tutto come per la sezione luci» (#376).
 *
 * La finestra taglia a dodici, ed è un taglio giusto: oltre, la scheda smette
 * di essere un riassunto. Ma era muto. Qui si guarda una casa con sedici
 * batterie: dodici si vedono, il tasto dice che ce ne sono sedici, e toccandolo
 * escono tutte.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const QUANTE = 16;

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

const STATI = Object.fromEntries(
  Array.from({ length: QUANTE }, (_valore, indice) => {
    const id = `sensor.batteria_${indice + 1}`;
    return [
      id,
      {
        entity_id: id,
        /* La prima è scarica: senza almeno una sotto il venti la tessera non
         * compare, ed è giusto così — non c'è niente da dire. */
        state: String(indice === 0 ? 8 : 40 + indice),
        attributes: {
          friendly_name: `Batteria ${indice + 1}`,
          unit_of_measurement: "%",
          device_class: "battery",
        },
      },
    ];
  }),
);

test("le batterie oltre le prime dodici si mostrano col tasto", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, elenco }) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      /* Le batterie sorvegliate sono un gruppo di avvisi: si dichiarano lì. */
      window.localStorage.setItem("cd_gruppi_extra", JSON.stringify({ batt: elenco }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: STATI, elenco: Object.keys(STATI) },
  );

  const tessera = page.locator('.dm-tile[data-dm-widget="batterie"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.click();

  const caselle = page.locator("#dm-widget-popup .dm-w-caselle .dm-w-casella");
  await expect(caselle.first()).toBeVisible({ timeout: 10_000 });
  const quante = await caselle.count();
  const viste = () => caselle.evaluateAll((nodi) => nodi.filter((n) => !n.hidden).length);
  expect(quante).toBeGreaterThan(12);
  expect(await viste()).toBe(12);

  /* Il tasto dice quante sono in tutto, non quante se ne vedono. */
  const tasto = page.locator("#dm-widget-popup [data-dm-w-tutte-misure]").first();
  await expect(tasto).toBeVisible();
  await expect(tasto).toContainText(String(quante));
  await tasto.click();
  expect(await viste()).toBe(quante);
  await expect(tasto).toHaveAttribute("aria-expanded", "true");

  /* E si richiude. */
  await tasto.click();
  expect(await viste()).toBe(12);
});

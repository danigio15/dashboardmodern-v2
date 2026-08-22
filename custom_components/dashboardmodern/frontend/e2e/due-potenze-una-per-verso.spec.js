/* Issue #184 — «non permette l'inserimento della seconda entità».
 *
 * Chi ha due sensori di potenza separati — prelievo e immissione, carica e
 * scarica, sempre positivi — non aveva dove mettere il secondo: la casella
 * della potenza e' una, e nel riquadro del verso opposto c'era soltanto il
 * rimando «e' una sola, si imposta in...», che sembrava la spunta della
 * sorgente unica ancora accesa. E togliere davvero quella spunta deve
 * riaccendere le caselle dei due versi.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
    energy: {
      grid: { signed: { power: "sensor.rete_w", positive: "import" } },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

test("tolta la spunta le caselle si riaccendono, e il secondo sensore ha la sua", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("energy");
  });
  await page.evaluate(() => {
    document
      .querySelector('[data-energy-signed="grid"]')
      ?.closest("details.ed-acc")
      ?.setAttribute("open", "");
  });

  const card = page.locator('[data-energy-signed="grid"]');
  await expect(card).toHaveAttribute("data-state", "on");
  // Con la sorgente unica dichiarata anche la casella del secondo sensore e' spenta.
  await expect(page.locator("#dm-energy-grid-power").first()).toBeDisabled();
  await expect(page.locator("#dm-energy-grid-power_export")).toBeDisabled();

  // Si toglie la spunta, come nell'issue.
  await card.locator('[data-energy-signed-toggle="grid"]').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelectorAll("#ed-body details.ed-acc").forEach((d) => d.setAttribute("open", ""));
  });

  // Le caselle dei due versi sono di nuovo scrivibili — non «come se la spunta
  // fosse ancora presente».
  await expect(page.locator("#dm-energy-grid-power").first()).toBeEnabled();
  await expect(page.locator("#dm-energy-grid-power_export")).toBeEnabled();
  await expect(page.locator("#dm-energy-grid-daily_import_energy")).toBeEnabled();
  await expect(page.locator("#dm-energy-grid-daily_export_energy")).toBeEnabled();

  // Il secondo sensore di potenza si scrive nella sua casella, nel riquadro
  // dell'immissione: prima li' c'era soltanto il rimando.
  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const input = document.getElementById(id);
      input.value = valore;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    scrivi("dm-energy-grid-power", "sensor.prelievo_w");
    scrivi("dm-energy-grid-power_export", "sensor.immissione_w");
  });
  await page.waitForTimeout(700);

  const grid = await page.evaluate(
    () => window.DashboardModernModules?.store?.getSection?.("energy")?.grid,
  );
  expect(grid.power).toBe("sensor.prelievo_w");
  expect(grid.power_export).toBe("sensor.immissione_w");
  expect(grid.signed).toBeUndefined();
});

test("dalla coppia esce un solo numero, col segno del verso", async ({ page }, testInfo) => {
  const conCoppia = JSON.parse(JSON.stringify(seed));
  conCoppia.sections.energy = {
    grid: { power: "sensor.prelievo_w", power_export: "sensor.immissione_w" },
    battery: { power: "sensor.carica_w", power_discharge: "sensor.scarica_w" },
  };
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, conCoppia);

  await page.evaluate(() => {
    const stati = {
      "sensor.prelievo_w": {
        entity_id: "sensor.prelievo_w",
        state: "1200",
        attributes: { unit_of_measurement: "W" },
      },
      "sensor.immissione_w": {
        entity_id: "sensor.immissione_w",
        state: "300",
        attributes: { unit_of_measurement: "W" },
      },
      "sensor.carica_w": {
        entity_id: "sensor.carica_w",
        state: "500",
        attributes: { unit_of_measurement: "W" },
      },
      "sensor.scarica_w": {
        entity_id: "sensor.scarica_w",
        state: "0",
        attributes: { unit_of_measurement: "W" },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });

  const lettura = (slot) =>
    page.evaluate((riferimento) => {
      const stato = window.eval(
        `typeof STATES !== "undefined" ? STATES[${JSON.stringify(riferimento)}] : null`,
      );
      return stato ? String(stato.state) : null;
    }, slot);

  // Rete: prelievo 1200, immissione 300 → scambio +900 (verso il prelievo).
  await expect.poll(() => lettura("dm.energy_potenza_scambio_rete")).toBe("900");
  // Batteria: carica 500, scarica 0 → il runtime vuole positiva la scarica: -500.
  await expect.poll(() => lettura("dm.energy_potenza_batteria")).toBe("-500");
});

/* «Nella home il chip indica 6 finestre aperte ma in realtà sono 6 tapparelle»
 * (#442).
 *
 * Qui si accende la plancia con sei tapparelle e nessun contatto, e si guarda
 * cosa dice la tessera: deve dire che sono tapparelle, e che sono alzate.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const TAPPARELLE = ["salotto", "cucina", "camera", "studio", "bagno", "corridoio"];

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
    covers: TAPPARELLE.map((nome) => ({
      name: nome[0].toUpperCase() + nome.slice(1),
      entity: `cover.${nome}`,
    })),
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const STATI = Object.fromEntries(
  TAPPARELLE.map((nome) => [
    `cover.${nome}`,
    {
      entity_id: `cover.${nome}`,
      state: "open",
      attributes: {
        friendly_name: nome[0].toUpperCase() + nome.slice(1),
        device_class: "shutter",
        current_position: 100,
        supported_features: 15,
      },
    },
  ]),
);

async function avvia(page, testInfo, stati = STATI) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((s) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...s } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, s);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  }, stati);
}

test("sei tapparelle alzate non sono sei finestre aperte", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  const tessera = page.locator('.dm-tile[data-dm-widget="tapparelle"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("6");
  /* Il nome dice cosa conta: qui dentro non c'è un solo contatto sull'anta. */
  await expect(tessera).toContainText("Tapparelle");
  await expect(tessera).not.toContainText("Finestre");
  await page.screenshot({ path: testInfo.outputPath("chip-tapparelle.png") });
  await testInfo.attach("chip-tapparelle", {
    path: testInfo.outputPath("chip-tapparelle.png"),
    contentType: "image/png",
  });
});

test("a tapparelle giù la tessera lo dice con la parola giusta", async ({ page }, testInfo) => {
  const giu = Object.fromEntries(
    Object.entries(STATI).map(([id, stato]) => [
      id,
      { ...stato, state: "closed", attributes: { ...stato.attributes, current_position: 0 } },
    ]),
  );
  await avvia(page, testInfo, giu);

  const tessera = page.locator('.dm-tile[data-dm-widget="tapparelle"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("0");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Tutte abbassate");
});

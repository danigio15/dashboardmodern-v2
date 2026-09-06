/* Il widget Luci le elenca tutte, interruttori compresi (#335).
 *
 * «Nel widget luci scrive il totale luci compresi gli switch, ma nella lista
 * sotto non li fa vedere.» L'elenco si fermava a quattordici righe: chi ha
 * molte luci vedeva un numero in alto e una lista che non lo raggiungeva. Qui
 * ci sono venti fra luci e interruttori aggiunti a mano: il numero e la lista
 * dicono la stessa cosa, e la lista scorre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LUCI = ["light.salotto", "light.cucina", "light.camera", "light.bagno"];
const INTERRUTTORI = Array.from({ length: 16 }, (_, i) => `switch.presa_${i + 1}`);
const TUTTE = [...LUCI, ...INTERRUTTORI];
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salotto", name: "Salotto", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: TUTTE.map((entity) => ({ entity, name: entity.split(".")[1] })),
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

test("venti fra luci e interruttori: il numero e la lista dicono la stessa cosa", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((tutte) => {
    const stati = eval("_RAW_STATES");
    for (const id of tutte)
      stati[id] = {
        entity_id: id,
        state: id === "light.salotto" || id === "switch.presa_16" ? "on" : "off",
        attributes: { friendly_name: id },
      };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, TUTTE);
  await page.waitForTimeout(1200);
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]');
  await expect(tessera).toContainText("2");
  await tessera.click();
  const popup = page.locator("#dm-widget-popup");
  await expect(popup).toBeVisible();
  /* Tutte e venti, con gli interruttori in fondo alla lista come le luci
   * spente, e l'ultimo interruttore — acceso — in cima con la luce accesa. */
  await expect(popup.locator("[data-dm-w-light]")).toHaveCount(TUTTE.length);
  await expect(popup.locator('[data-dm-w-light="switch.presa_1"]')).toHaveCount(1);
  const primeDue = await popup.locator("[data-dm-w-light]").evaluateAll((nodi) =>
    nodi
      .slice(0, 2)
      .map((n) => n.dataset.dmWLight)
      .sort(),
  );
  expect(primeDue).toEqual(["light.salotto", "switch.presa_16"]);
  /* E la lista scorre dentro la finestra invece di sparire. */
  const scorre = await popup
    .locator(".dm-w-body")
    .evaluate((corpo) => corpo.scrollHeight > corpo.clientHeight);
  expect(scorre).toBe(true);
});

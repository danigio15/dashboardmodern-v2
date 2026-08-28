/* Il corpo della finestra si riscrive solo quando cambia davvero.
 *
 * Il confronto si faceva contro `body.innerHTML`, cioe' contro il documento
 * vivo. Le miniature delle telecamere pero' nel markup nascono senza
 * fotogramma — la foto la posa dopo chi la scarica, insieme al suo «pronto» —
 * quindi il documento e il markup appena generato erano SEMPRE diversi: a ogni
 * evento di stato il corpo si rifaceva da capo, i riquadri delle telecamere
 * venivano buttati via e ricaricati, e da fuori si vedeva il nero e il
 * rinfresco senza fine.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [
      { id: "cam1", name: "Ingresso", entity: "camera.ingresso" },
      { id: "cam2", name: "Giardino", entity: "camera.giardino" },
    ],
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

test("le miniature aperte sopravvivono agli eventi di stato", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const entity of ["camera.ingresso", "camera.giardino"])
      stati[entity] = {
        entity_id: entity,
        state: "idle",
        attributes: { entity_picture: `/api/camera_proxy/${entity}` },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1400);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="telecamere"]').click();
  await expect(page.locator("#dm-widget-popup .dm-w-cam").first()).toBeVisible();

  /* Si segnano i riquadri che ci sono adesso: se il corpo si rifa', quelli
     vecchi escono dal documento e questi segni non si ritrovano piu'. */
  await page.evaluate(() => {
    document
      .querySelectorAll("#dm-widget-popup .dm-w-cam")
      .forEach((figura, indice) => (figura.dataset.dmProva = String(indice)));
  });

  for (let giro = 0; giro < 4; giro += 1) {
    await page.evaluate((n) => {
      const stati = eval("_RAW_STATES");
      stati["sensor.qualcosa"] = { entity_id: "sensor.qualcosa", state: String(n), attributes: {} };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, giro);
    await page.waitForTimeout(250);
  }

  const segnati = await page.locator("#dm-widget-popup .dm-w-cam[data-dm-prova]").count();
  expect(segnati, "il corpo della finestra si e' rifatto e ha buttato le miniature").toBe(2);
});

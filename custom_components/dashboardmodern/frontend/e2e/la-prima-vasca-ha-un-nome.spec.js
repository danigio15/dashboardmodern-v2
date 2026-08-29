/* Anche la prima vasca ha un nome.
 *
 * Segnalato con una schermata: «non è possibile dare un nome alla piscina 1,
 * alle altre piscine è possibile dare il nome». La maschera di sopra è quella
 * che c'è sempre stata e configura la prima vasca — sensori, comandi,
 * filtrazione — ma un nome non glielo chiedeva: quando la piscina era una sola
 * si chiamava «Piscina» e bastava. Dalla seconda in poi serve, e le altre il
 * nome ce l'hanno: la prima restava l'unica senza.
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
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { piscina: true },
};

test("il nome della prima vasca si scrive e resta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });

  await page.evaluate(() => {
    localStorage.setItem(
      "cd_piscina",
      JSON.stringify({
        tempEnt: "sensor.piscina_temp",
        pools: [{ name: "Idromassaggio", tempEnt: "sensor.spa_temp" }],
      }),
    );
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita();
    window.editorSwitch("pool");
  });
  await page.waitForTimeout(600);

  const nome = page.locator("#dm-pool-first-name");
  await expect(nome).toBeVisible();
  await expect(nome).toHaveValue("");

  await nome.fill("Grande");
  await nome.blur();
  await page.waitForTimeout(400);

  const salvato = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_piscina") || "{}");
    } catch (errore) {
      return {};
    }
  });
  expect(salvato.name).toBe("Grande");
  /* E non ha portato via niente alle altre. */
  expect(salvato.tempEnt).toBe("sensor.piscina_temp");
  expect(salvato.pools?.[0]?.name).toBe("Idromassaggio");

  /* Riaperta la scheda, il nome e' ancora li'. */
  await page.evaluate(() => window.editorSwitch("pool"));
  await page.waitForTimeout(400);
  await expect(page.locator("#dm-pool-first-name")).toHaveValue("Grande");
});

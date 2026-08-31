/* La carta «Stato termico (Caldo)» e il flag della card girata stanno SOLO
 * nella scheda Clima.
 *
 * Dal campo: «quello che e' presente in tutte le sezioni e' stato termico
 * caldaia e il flag per la card clima di invertire». L'ancora era il campo
 * stanza del Clima, ma sui dispositivi veri le due carte comparivano in ogni
 * scheda della configurazione: ora si montano solo con la scheda Clima
 * attiva, e trovate fuori posto si tolgono da sole.
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
  visibility: { home: true },
};

test("montate nel Clima, assenti (e spazzate) nelle altre schede", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const clima = [...document.querySelectorAll(".ed-tab")].find((tab) =>
      /clima/i.test(tab.textContent || ""),
    );
    clima?.click();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(page.locator("#ed-body [data-dm-termico-caldo]")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("#ed-body [data-dm-cl-inverti]")).toBeVisible({ timeout: 10000 });

  for (const scheda of ["doors", "avvisi", "prese"]) {
    await page.evaluate((t) => {
      window.editorSwitch?.(t);
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    }, scheda);
    await page.waitForTimeout(700);
    await expect(page.locator("#ed-body [data-dm-termico-caldo]")).toHaveCount(0);
    await expect(page.locator("#ed-body [data-dm-cl-inverti]")).toHaveCount(0);
    /* E anche se un ridisegno le lasciasse in giro, la spazzata le toglie. */
    await page.evaluate(() => {
      const corpo = document.getElementById("ed-body");
      const finta = document.createElement("div");
      finta.dataset.dmTermicoCaldo = "";
      corpo.append(finta);
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await expect(page.locator("#ed-body [data-dm-termico-caldo]")).toHaveCount(0, {
      timeout: 5000,
    });
  }
});

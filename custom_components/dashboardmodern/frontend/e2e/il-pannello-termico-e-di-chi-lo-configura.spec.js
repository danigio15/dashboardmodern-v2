/* Il pannello termico del popup Caldo, sul documento vero.
 *
 * Le tre righe cablate del guscio — Caldaia, Pompa termocamino, Aspiratore
 * canna fumaria — per chiunque non avesse QUELLE entita' dicevano «N/D» per
 * sempre. Ora le voci vivono in `cd_termico_caldo`: senza voci il pannello
 * sparisce, con una voce compare quella e solo quella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "c1", name: "Bagno", entity: "input_boolean.termo_bagno", type: "termo" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("senza voci il pannello sparisce, con una voce compare quella sola", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriQuickClima?.();
    window.setQuickClimaMode?.("caldo");
  });

  /* Questa casa non ha ne' switch.caldaia ne' i vecchi slot: il pannello
   * non ha niente da dire, e non dice niente. */
  const pannello = page.locator("#ns-thermal-panel");
  await expect(pannello).toBeHidden({ timeout: 20000 });
  await expect(page.locator("#quick-clima-modal")).not.toContainText("Pompa termocamino");

  /* Una voce configurata: compare lei, e solo lei. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(pannello).toBeVisible({ timeout: 10000 });
  await expect(pannello.locator(".ns-thermal-row")).toHaveCount(1);
  await expect(pannello).toContainText("Pompa pellet");
  await expect(pannello).not.toContainText("Caldaia");

  /* E la scheda Clima della configurazione porta il campo libero. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const clima = [...document.querySelectorAll(".ed-tab")].find((tab) =>
      /clima/i.test(tab.textContent || ""),
    );
    clima?.click();
  });
  const carta = page.locator("#editor-modal [data-dm-termico-caldo]");
  await expect(carta).toBeVisible({ timeout: 20000 });
  await expect(carta.locator(".dm-termico-riga")).toHaveCount(1);
});

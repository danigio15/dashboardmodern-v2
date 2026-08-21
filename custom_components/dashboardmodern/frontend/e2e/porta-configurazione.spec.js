import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una porta per la configurazione che c'e' sempre.
 *
 * Il cartello "Configura la dashboard" sparisce appena si collega la prima
 * entita', e da quel momento resta la voce nella barra in fondo — che sul
 * computer sta a riposo fuori dallo schermo e in qualche finestra non si
 * lascia trovare affatto. Chi si e' trovato cosi' ha dovuto disinstallare e
 * rimettere l'integrazione per rivedere il cartello.
 */
const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "cucina", name: "Cucina", temp: "sensor.t" }],
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
  visibility: { home: true, temp: true },
};

test.describe("la porta della configurazione", () => {
  test("l'ingranaggio in cima apre la configurazione, a plancia gia' configurata", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

    // Configurata: il cartello dell'inizio ha finito il suo lavoro.
    const ingranaggio = page.locator("header #dm-editor-entry");
    await expect(ingranaggio).toHaveCount(1);
    await expect(ingranaggio).toBeVisible();

    await ingranaggio.click();
    await expect(page.locator("#editor-modal")).toBeVisible();
  });

  test("resta al suo posto anche quando l'intestazione si ridisegna", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
    await expect(page.locator("header #dm-editor-entry")).toHaveCount(1);

    await page.evaluate(() => {
      // Chi ridisegna l'intestazione se la porta via: deve tornare da sola.
      document.getElementById("dm-editor-entry")?.remove();
      window.render?.();
    });
    await expect(page.locator("header #dm-editor-entry")).toHaveCount(1);
  });
});

/* «La sezione azioni rapide non si renderizza bene» — con due o tre azioni su
 * uno schermo largo ogni tasto si stirava a mezzo metro: la griglia era
 * dichiarata apposta senza tetto di larghezza, e il campo ha risposto con la
 * foto delle card enormi. E «ho inserito cancello e mi ritrovo una sbarra dei
 * lavori stradali»: il ripiego a emoji della voce Cancello era 🚧.
 *
 * Qui si semina il vassoio con tre azioni su una scheda larga e si pretende
 * che i tasti restino tasti — al massimo 220 pixel piu' il bordo — e che il
 * cancello esca col disegno di casa, non con la sbarra.
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

test("i tasti del vassoio restano tasti anche su una scheda larga", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1248, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([
        { type: "builtin", builtin: "luci", name: "Luci" },
        { type: "builtin", builtin: "clima", name: "Clima" },
        { type: "toggle", name: "Cancello", entity: "switch.cancello", icon: "mdi:gate" },
      ]),
    );
    window.buildQuickActions?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });

  const tasti = page.locator("#page-home .dm-vassoio #qa-grid .qa-btn");
  await expect(tasti).toHaveCount(3, { timeout: 20000 });

  /* Tasti, non lenzuola: il tetto e' 220px di colonna piu' un margine di
   * tolleranza per bordi e arrotondamenti. */
  for (const tasto of await tasti.all()) {
    const larghezza = (await tasto.boundingBox())?.width || 0;
    expect(larghezza, "un tasto del vassoio non si stira").toBeLessThanOrEqual(240);
    expect(larghezza).toBeGreaterThan(120);
  }

  /* Il cancello e' il disegno di casa (un svg), non la sbarra dei lavori. */
  const iconaCancello = page.locator("#qa-grid .qa-btn", { hasText: "Cancello" }).locator(".icon");
  await expect(iconaCancello).not.toContainText("🚧");
  await expect
    .poll(() => iconaCancello.evaluate((nodo) => nodo.querySelectorAll("svg").length), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
});

/* La presa che si guarda e basta non ha l'interruttore.
 *
 * Dal campo: «switch prese: se disabilitata la possibilita' di spegnere devi
 * togliere lo switch». La card restava con la levetta disegnata accanto alla
 * pillola Solo lettura: ora la levetta sparisce proprio, il lucchetto resta.
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

test("la card bloccata perde la levetta, quella libera la tiene", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_prese",
      JSON.stringify([
        { id: "p1", name: "Frigo", entity: "switch.frigo", icon: "🔌", room_id: "" },
        { id: "p2", name: "TV", entity: "switch.tv", icon: "🔌", room_id: "" },
      ]),
    );
    window.localStorage.setItem("cd_solo_lettura", JSON.stringify({ "switch.frigo": true }));
    const stati = eval("_RAW_STATES");
    for (const id of ["switch.frigo", "switch.tv"])
      stati[id] = { entity_id: id, state: "on", attributes: {} };
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.render?.();
  });
  /* Alla pagina delle prese ci si va dalla sua voce nella barra, come ci va
   * una persona: e' quel tocco che chiede il disegno. Accendere la classe da
   * fuori lascia la pagina attiva e vuota — con la pagina chiusa il disegno
   * non gira apposta — finche' non passa per caso un altro giro di stati. */
  const voce = page.locator('.tab[data-tab="prese"]');
  await expect(voce).toBeAttached({ timeout: 20000 });
  /* Il tocco si da' alla voce, non al pixel: sul tablet la barra parte
   * raccolta e un click per coordinate non troverebbe niente da colpire. Il
   * gestore che gira e' lo stesso che gira sotto il dito. */
  await voce.evaluate((nodo) => nodo.click());
  const bloccata = page.locator('#page-prese [data-dm-lucip="switch.frigo"]');
  await expect(bloccata).toBeAttached({ timeout: 20000 });
  await expect(bloccata.locator(".dm-lucip-led")).toHaveCount(0);
  await expect(bloccata.locator('.dm-lucip-badge[data-kind="bloccata"]')).toBeAttached();
  const libera = page.locator('#page-prese [data-dm-lucip="switch.tv"]');
  await expect(libera.locator(".dm-lucip-led")).toHaveCount(1);
});

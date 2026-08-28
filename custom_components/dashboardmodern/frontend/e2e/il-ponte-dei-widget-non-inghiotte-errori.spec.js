/* Il giro di disegno dei widget non deve rompersi in silenzio.
 *
 * `schedule()` chiama il ridisegno dentro un try/catch che scrive soltanto un
 * avviso in console: e' giusto — un difetto in una tessera non deve portarsi
 * dietro tutta la Home — ma vuol dire che un errore vero non si vede da
 * nessuna parte. E' successo davvero: una funzione finita per sbaglio DENTRO
 * un'altra invece che a livello di modulo. Il primo disegno funzionava, e da
 * li' in poi ogni aggiornamento moriva nel catch: le tessere restavano ferme
 * sul primo valore e il corpo del popup non si riscriveva piu'. Nessuna prova
 * lo diceva, perche' ognuna guardava la sua cosa e trovava il primo disegno.
 *
 * Questa prova guarda proprio il silenzio: se il ridisegno solleva qualcosa,
 * qui si vede.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "🛋️", metadata: {} }],
    lights: [{ id: "l1", name: "Lampada", entity: "light.salone", room: "room-salone" }],
    climate: [{ id: "c1", name: "Salone", entity: "climate.salone", room: "room-salone" }],
    cameras: [],
    appliances: [],
    loads: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("il ridisegno dei widget non finisce nel catch", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const lamenti = [];
  page.on("console", (messaggio) => {
    if (messaggio.text().includes("[DashboardModern] home widgets")) lamenti.push(messaggio.text());
  });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });

  /* Il primo disegno non basta: l'errore di quella volta stava nel giro che
     riscrive i VALORI, cioe' dal secondo in poi. Si fanno cambiare gli stati
     un paio di volte e si guarda se qualcuno si lamenta. */
  for (const acceso of [true, false, true]) {
    await page.evaluate((on) => {
      const stati = eval("_RAW_STATES");
      stati["light.salone"] = {
        entity_id: "light.salone",
        state: on ? "on" : "off",
        attributes: {},
      };
      stati["climate.salone"] = {
        entity_id: "climate.salone",
        state: on ? "cool" : "off",
        attributes: { current_temperature: on ? 24.5 : 19.5, temperature: 22 },
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, acceso);
    await page.waitForTimeout(400);
  }

  expect(lamenti, `il ridisegno si e' rotto: ${lamenti.join(" | ")}`).toEqual([]);
  // E le tessere sono ancora vive, non ferme al primo disegno.
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]')).toBeVisible();
});

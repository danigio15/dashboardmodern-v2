/* La scena del MiniPC sta in cima, e la telemetria riempie la sua riga.
 *
 * Le righe di questa griglia sono contate a mano, e la numerazione era stata
 * scritta quando la pagina cominciava con la sua scena: intestazioni di sezione
 * non ce n'erano. Da quando ogni sezione ne ha una, quella si prende la prima
 * riga — l'unica libera — e la scena finiva in coda alla pagina, sotto la
 * telemetria: il pezzo piu' grosso della sezione, in fondo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPED = {
  "dm.server_cpu": "sensor.cpu",
  "dm.server_ram": "sensor.ram",
  "dm.server_disco": "sensor.disk",
  "dm.server_potenza_raspberry_server": "sensor.power",
  "dm.server_speedtest_download": "sensor.download",
  "dm.server_speedtest_upload": "sensor.upload",
};

const seed = {
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
    entityOverrides: MAPPED,
  },
  visibility: { home: true, server: true },
};

async function apriMiniPc(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-server")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(page.locator("#page-server")).toHaveClass(/dm-srvx/);
}

test("la scena sta sopra la telemetria, non in fondo alla pagina", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await apriMiniPc(page);

  const scena = page.locator("#page-server .srv-hero");
  const telemetria = page.locator("#page-server .srv-tel-grid");
  await expect(scena).toBeVisible();
  await expect(telemetria).toBeVisible();

  await expect
    .poll(async () => {
      const alto = await scena.evaluate((node) => node.getBoundingClientRect().top);
      const basso = await telemetria.evaluate((node) => node.getBoundingClientRect().top);
      return alto < basso ? "la scena sta sopra" : "la scena sta sotto";
    })
    .toBe("la scena sta sopra");

  // E sta sotto l'intestazione della sezione, che resta la prima cosa.
  const intestazione = page.locator("#page-server .dm-page-mast");
  if (await intestazione.count()) {
    const su = await intestazione.evaluate((node) => node.getBoundingClientRect().top);
    const giu = await scena.evaluate((node) => node.getBoundingClientRect().top);
    expect(su).toBeLessThan(giu);
  }
});

test("le pastiglie di telemetria riempiono la riga invece di lasciarne una orfana", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await apriMiniPc(page);

  // Senza la card termica la telemetria prende tutta la larghezza: tre
  // pastiglie su due colonne lasciavano la terza da sola, larga mezza pagina.
  await expect(page.locator("#page-server")).toHaveAttribute("data-dm-srvx-thermal", "off");

  const righe = await page
    .locator("#page-server .srv-tel-card")
    .evaluateAll((nodi) =>
      nodi
        .filter((nodo) => nodo.getBoundingClientRect().width > 0)
        .map((nodo) => Math.round(nodo.getBoundingClientRect().top)),
    );
  expect(righe.length).toBeGreaterThanOrEqual(3);
  expect(new Set(righe).size).toBe(1);
});

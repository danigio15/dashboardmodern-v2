/* Il popup «Clima attivi» distingue caldo e freddo, e tutto dice da quanto.
 *
 * Dal campo: «il popup widget non distingue caldo/freddo (mostra tutto
 * insieme) e deve dire da quanto tempo i clima sono accesi, idem la
 * caldaia»; e «se la caldaia e' configurata con un'entita', mostrare
 * Caldaia accesa» — la pillola sotto il meteo leggeva switch.caldaia
 * cablato, ora segue la voce caldaia di `cd_termico_caldo`.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ORE = 3600 * 1000;

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { id: "c1", name: "Salone", entity: "climate.salone", type: "clima" },
      { id: "c2", name: "Camera", entity: "climate.camera", type: "clima" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

function stati(adesso) {
  return {
    "climate.salone": {
      entity_id: "climate.salone",
      state: "cool",
      last_changed: new Date(adesso - 2 * ORE).toISOString(),
      attributes: { friendly_name: "Clima Salone" },
    },
    "climate.camera": {
      entity_id: "climate.camera",
      state: "heat",
      last_changed: new Date(adesso - 25 * 60 * 1000).toISOString(),
      attributes: { friendly_name: "Clima Camera" },
    },
    "switch.caldaia_pellet": {
      entity_id: "switch.caldaia_pellet",
      state: "on",
      last_changed: new Date(adesso - 3 * ORE).toISOString(),
      attributes: { friendly_name: "Caldaia pellet" },
    },
  };
}

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((extra) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...extra } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, extra);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati(Date.now()));
  await page.waitForTimeout(1500);
}

test("il popup Clima attivi separa Riscaldano e Raffrescano e dice da quanto", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  /* Il gruppo `clima` del Quadro Avvisi in questa casa sintetica resta
   * vuoto (la semina v272 gira prima che lo store porti le unita'): lo si
   * riempie come farebbe il guscio, dentro la sua portata lessicale. */
  await page.evaluate(() =>
    window.eval(
      "if (!GRUPPI_MONITORAGGIO['clima'].length) GRUPPI_MONITORAGGIO['clima'].push('climate.salone','climate.camera')",
    ),
  );
  await page.evaluate(() => window.apriDettagli(null, "clima"));
  const lista = page.locator("#details-list");
  await expect(lista.locator(".detail-row")).toHaveCount(2, { timeout: 10000 });
  /* Le due testate, col freddo prima e il caldo dopo. */
  const testate = lista.locator(".dm-clpd-testata");
  await expect(testate).toHaveCount(2);
  await expect(testate.nth(0)).toContainText("Raffrescano");
  await expect(testate.nth(1)).toContainText("Riscaldano");
  /* La riga in heat sta dopo la testata del caldo. */
  const ordine = await lista.evaluate((nodo) =>
    [...nodo.children].map((f) => f.textContent.includes("Riscaldano") || f.textContent),
  );
  const dove = ordine.indexOf(true);
  expect(ordine.slice(dove + 1).join(" ")).toContain("Camera");
  /* E ogni riga dice da quanto. */
  await expect(lista).toContainText("acceso da 2 h");
  await expect(lista).toContainText("acceso da 25 min");
});

test("la pillola Caldaia segue la voce configurata, col suo orologio", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  const pillola = page.locator("#caldaia-banner");

  /* Caldaia configurata su un'entita' accesa: pillola visibile, con il
   * tempo. Il vecchio switch.caldaia cablato qui non esiste nemmeno. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Caldaia", entity: "switch.caldaia_pellet", icon: "🔥" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(pillola).toHaveClass(/show/, { timeout: 10000 });
  await expect(pillola).toContainText("Caldaia accesa · 3 h");

  /* E il pannello del popup Caldo porta lo stesso orologio sulla riga. */
  await page.evaluate(() => {
    window.apriQuickClima?.();
    window.setQuickClimaMode?.("caldo");
  });
  const rigaCaldaia = page.locator('#ns-thermal-panel [data-dm-termico="switch.caldaia_pellet"]');
  await expect(rigaCaldaia).toBeVisible({ timeout: 10000 });
  await expect(rigaCaldaia).toContainText("da 3 h");

  /* Config senza una caldaia: la pillola non ha piu' niente da dire. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Pompa pellet", entity: "switch.caldaia_pellet", icon: "♨️" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(pillola).not.toHaveClass(/show/, { timeout: 10000 });
});

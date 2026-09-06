/* La tessera Auto in Home dice il vero, e lo dice una volta (#348).
 *
 * «Nella sezione batteria 12 V in questo momento e' a 14 V, mi da' 14%; nel
 * widget dell'auto mi trovo nella sezione stato cinque volte la stessa
 * entita' con scritto spento; e sempre nel widget la ricarica risulta
 * scollegata, ma se entri nella pagina dedicata la vedi collegata.»
 *
 * Qui si guarda quello che vede chi apre la plancia: la finestra della
 * tessera con cinque profili uguali — quelli che il vecchio collegamento
 * dall'integrazione lasciava — e il cavo attaccato a carica ferma; e la
 * pagina Auto con la batteria di servizio pubblicata in volt.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leaf_soc",
  "dm.ev_autonomia": "sensor.leaf_autonomia",
  "dm.ev_stato_ricarica": "binary_sensor.wallbox_charging",
  "dm.ev_cavo_collegato": "binary_sensor.wallbox_cavo",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_motore": "binary_sensor.leaf_motore",
  "dm.ev_batteria_servizio": "sensor.leaf_12v",
};

const VALORI = {
  "sensor.leaf_soc": ["53", "%"],
  "sensor.leaf_autonomia": ["180", "km"],
  "binary_sensor.wallbox_charging": ["off", ""],
  "binary_sensor.wallbox_cavo": ["on", ""],
  "sensor.wallbox_potenza": ["0", "W"],
  "binary_sensor.leaf_motore": ["off", ""],
  "sensor.leaf_12v": ["14.2", "V"],
  "light.salone": ["on", ""],
};

/* Cinque profili della stessa auto: e' quello che restava a chi collegava
 * l'integrazione piu' volte prima della 1.4.10. */
const PROFILI = [1, 2, 3, 4, 5].map((n) => ({
  id: `auto${n}`,
  uid: `auto-${n}`,
  name: "Leaf",
  tipo: "ibrida",
  ov: { ...MAPPA },
}));

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Luce", entity: "light.salone" }],
    climate: [],
    ev: PROFILI,
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true, ev: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ mappa, profili }) => {
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      localStorage.setItem("cd_ev_cars", JSON.stringify(profili));
      localStorage.setItem("cd_ev_car_active", "0");
      window.cdApplyCanonicalOverrides?.(mappa);
    },
    { mappa: MAPPA, profili: PROFILI },
  );
  await page.evaluate((valori) => {
    const stati = eval("_RAW_STATES");
    for (const [entity, [state, unita]] of Object.entries(valori))
      stati[entity] = {
        entity_id: entity,
        state,
        attributes: {
          friendly_name: entity.split(".")[1].replaceAll("_", " "),
          ...(unita ? { unit_of_measurement: unita } : {}),
        },
      };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VALORI);
  await page.waitForTimeout(1500);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

const testi = (page, selettore) =>
  page
    .locator(`#dm-widget-popup ${selettore}`)
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.replace(/\s+/g, " ").trim()));

test("la finestra della tessera: il cavo una volta, e «Collegata» come la pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="ev"]').click();
  await expect(page.locator("#dm-widget-popup .dm-w-casella").first()).toBeVisible();

  /* Cinque profili uguali sono un'auto: la carica si legge una volta. */
  const caselle = await testi(page, ".dm-w-casella");
  expect(caselle.filter((testo) => /Carica/.test(testo))).toHaveLength(1);
  expect(caselle.filter((testo) => /Autonomia/.test(testo))).toHaveLength(1);

  /* E ogni sensore acceso/spento fa una pillola, non cinque. */
  const pillole = await testi(page, ".dm-w-pillola");
  expect(pillole.filter((testo) => /wallbox cavo/i.test(testo))).toHaveLength(1);
  expect(pillole.filter((testo) => /leaf motore/i.test(testo))).toHaveLength(1);

  /* Il sensore di carica dice «off» col cavo dentro: la tessera chiede al
   * nucleo con il cavo come testimone, come fa la pastiglia della pagina. */
  const ricarica = caselle.find((testo) => /Ricarica/.test(testo)) || "";
  expect(ricarica).toMatch(/Collegata/);
  expect(ricarica).not.toMatch(/Scollegata/);
});

test("la pagina Auto: la batteria da 12 V pubblicata in volt si legge in volt", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  const casella = page.locator(
    '#page-ev .dm-termica-misura[data-dm-storico="dm.ev_batteria_servizio"] b',
  );
  await expect(casella).toBeVisible();
  /* Quattordici virgola due volt: non «14%». */
  await expect(casella).toContainText("14,2");
  await expect(casella).toContainText("V");
  await expect(casella).not.toContainText("%");
});

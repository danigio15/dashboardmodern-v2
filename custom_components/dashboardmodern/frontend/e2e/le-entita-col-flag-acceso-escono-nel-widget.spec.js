/* Quello che l'interruttore «nel widget» promette, la tessera lo mantiene.
 *
 * L'interruttore sta accanto a OGNI entita' mappata, in ogni scheda della
 * configurazione, e acceso vuol dire «questa va in Home». Le tessere pero'
 * leggevano una lista di caselle scritta a mano: tre per l'auto, su venti che
 * la scheda EV sa mappare. L'interruttore poteva quindi solo TOGLIERE — chi
 * lo accendeva su una casella fuori da quella lista non vedeva succedere
 * niente, ed e' esattamente quello che e' stato segnalato due volte.
 *
 * Qui si mappa un'auto per intero e si guarda se in Home ci arriva tutto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.auto_soc",
  "dm.ev_autonomia": "sensor.auto_autonomia",
  "dm.ev_stato_ricarica": "sensor.auto_stato",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_energia_sessione": "sensor.wallbox_sessione",
  "dm.ev_odometro": "sensor.auto_odometro",
  "dm.ev_target_soc": "sensor.auto_target",
  "dm.ev_cavo_collegato": "binary_sensor.auto_cavo",
};

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Luce", entity: "light.salone" }],
    climate: [],
    ev: [{ id: "auto1", name: "La mia auto", ov: MAPPA }],
    /* Con una vettura sola la plancia legge la mappatura canonica — e' quella
       che «Usa» copia dal profilo — quindi la prova la scrive come farebbe lui. */
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true, ev: true },
};

const VALORI = {
  "sensor.auto_soc": ["62", "%"],
  "sensor.auto_autonomia": ["248", "km"],
  "sensor.auto_stato": ["In carica", ""],
  "sensor.wallbox_potenza": ["7400", "W"],
  "sensor.wallbox_sessione": ["18.2", "kWh"],
  "sensor.auto_odometro": ["42150", "km"],
  "sensor.auto_target": ["80", "%"],
  "binary_sensor.auto_cavo": ["on", ""],
  "light.salone": ["on", ""],
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((mappa) => {
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
  }, MAPPA);
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
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="ev"]').click();
  await expect(page.locator("#dm-widget-popup .dm-w-casella").first()).toBeVisible();
}

/* Dal 30 agosto il popup parla a carte: le misure stanno nelle caselle
 * (.dm-w-casella) e negli stati a pillola, le righe restano ai soli comandi.
 * La promessa dell'interruttore e' la stessa; si legge tutto quel che c'e'. */
const righe = (page) =>
  page
    .locator("#dm-widget-popup :is(.dm-w-casella, .dm-w-pillola, .dm-w-row)")
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.replace(/\s+/g, " ").trim()));

test("tutte le caselle mappate dell'auto arrivano nella finestra", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const testo = (await righe(page)).join(" | ");
  /* Le tre di sempre. */
  expect(testo).toContain("62%");
  expect(testo).toContain("248 km");
  /* E quelle che prima non uscivano, pur avendo l'interruttore acceso. */
  expect(testo, "la potenza della wallbox non arriva").toMatch(/7\.?400 W|7400 W/);
  expect(testo, "l'energia di sessione non arriva").toContain("18,2 kWh");
  expect(testo, "l'odometro non arriva").toMatch(/42\.?150 km/);
  expect(testo, "il target non arriva").toContain("80 %");
  expect(testo, "il cavo collegato non arriva").toContain("Acceso");
});

test("spegnendo l'interruttore la casella esce, e le altre restano", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem("cd_widgets", JSON.stringify({ excluded: ["sensor.auto_odometro"] }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect.poll(async () => (await righe(page)).join(" | ")).not.toMatch(/42\.?150/);
  const testo = (await righe(page)).join(" | ");
  expect(testo).toContain("18,2 kWh");
  expect(testo).toContain("62%");
});

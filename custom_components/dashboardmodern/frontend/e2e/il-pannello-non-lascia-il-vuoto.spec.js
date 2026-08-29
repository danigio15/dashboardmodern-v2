/* Nella finestra del Clima l'etichetta non lascia il vuoto sotto di se'.
 *
 * Nella schermata arrivata dalla casa vera si vedeva questo: «MODALITA'» in
 * alto, poi un buco, poi le pastiglie; «TEMPERATURA», un buco, il passo;
 * «VENTOLA», un buco, i numeri. Tre voragini in una finestra sola.
 *
 * Il motivo: l'etichetta ha «flex:0 0 82px», che nella riga orizzontale e' la
 * larghezza della colonna di sinistra. Sul telefono la riga diventa una
 * colonna, e quegli ottantadue pixel smettono di essere una larghezza e
 * diventano un'altezza — la parola «Modalita'» alta 82 pixel, col vuoto sotto.
 * La correzione c'era gia' («flex:none» sotto i 600), ma era scritta per una
 * sola delle due finestre: la riga sopra le nominava tutt'e due, queste no.
 * Un selettore aggiornato e il suo gemello dimenticato — che e' la stessa
 * famiglia di difetti dei due padroni, vista dall'altra parte.
 *
 * Qui si misura l'altezza vera dell'etichetta a plancia aperta. Una parola di
 * dieci pixel di corpo non puo' occuparne ottanta: se ci torna, il gemello e'
 * stato dimenticato un'altra volta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "k1", entity: "climate.salone", room: "r1", name: "Salone" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { clima: true, rooms: true },
};

test("l'etichetta del pannello non lascia il vuoto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["climate.salone"] = {
      entity_id: "climate.salone",
      state: "off",
      attributes: {
        friendly_name: "Salone",
        current_temperature: 31,
        temperature: 26,
        hvac_modes: ["fan_only", "dry", "cool", "heat", "heat_cool", "off"],
        fan_modes: ["auto", "Silence", "1", "2", "3", "4", "5"],
        fan_mode: "Silence",
      },
    };
    window.applyStates?.();
    window.render?.();
  });
  await page.evaluate(() => window.showPage?.("clima"));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document
      .querySelector(
        "#page-clima [data-dm-cl-card],#page-clima .dm-cl-card,#page-clima [data-entity]",
      )
      ?.click();
  });
  await page.waitForTimeout(800);

  const righe = await page.evaluate(() => {
    const finestra = document.querySelector("#clima-popup-overlay, #dm-widget-popup");
    if (!finestra) return [];
    return [...finestra.querySelectorAll(".dm-w-panel-row")].map((nodo) => ({
      alto: Math.round(nodo.getBoundingClientRect().height),
      testo: nodo.textContent.replace(/\s+/g, " ").trim().slice(0, 26),
      etichetta: Math.round(
        nodo.querySelector(".dm-w-panel-lbl")?.getBoundingClientRect().height ?? 0,
      ),
    }));
  });

  for (const riga of righe)
    console.log(`riga ${riga.alto}px — etichetta ${riga.etichetta}px — ${riga.testo}`);
  expect(righe.length, "il pannello del Clima deve avere le sue righe").toBeGreaterThan(0);
  for (const riga of righe)
    expect(
      riga.etichetta,
      `l'etichetta «${riga.testo}» e' alta ${riga.etichetta}px: e' il flex-basis della ` +
        "colonna, che in verticale e' diventato un'altezza",
    ).toBeLessThan(30);
});

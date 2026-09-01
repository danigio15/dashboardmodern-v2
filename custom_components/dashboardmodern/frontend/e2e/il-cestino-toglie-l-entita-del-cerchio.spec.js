/* Il cestino della «Potenza istantanea» toglie l'entita' davvero.
 *
 * Dal campo, con lo scatto dell'editor sotto gli occhi: «io elimino l'entita'
 * inserita per far usare il calcolo ma non la elimina». E' il gesto che serve
 * per far diventare il cerchio la somma di quello che ci sta dentro: finche'
 * quella casella resta scritta, il cerchio legge quel sensore e basta.
 *
 * La prova fa il gesto per intero — cestino, salva, riapri — e guarda dove
 * conta: nella configurazione salvata e nel campo riaperto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [
      {
        id: "elettro",
        name: "Elettrodomestici",
        icon: "🔌",
        order: 0,
        power_entity: "sensor.potenza_elettrodomestici_w_4",
      },
      {
        id: "condizionatori",
        name: "Condizionatori",
        icon: "❄️",
        power_entity: "sensor.condizionatori_w",
        metadata: { beta27_subload_group: "elettro" },
      },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { name: "Casa", grid: { power: "sensor.rete_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const watt = (state) => ({
  state,
  attributes: { unit_of_measurement: "W", device_class: "power" },
});

const STATI = {
  "sensor.potenza_elettrodomestici_w_4": watt("512"),
  "sensor.condizionatori_w": watt("310"),
  "sensor.rete_w": watt("820"),
};

const potenzaSalvata = (page) =>
  page.evaluate(() => {
    const store = window.DashboardModernModules?.store;
    const loads = store?.getSection?.("loads") || [];
    const gruppo = loads.find((item) => item.id === "elettro") || {};
    return {
      power_entity: gruppo.power_entity || "",
      entity: gruppo.entity || "",
      entities: gruppo.entities || [],
    };
  });

async function apriCarichi(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("energy");
    } catch (_errore) {}
  });
  const linguetta = page
    .locator("#editor-modal .ed-inner-tab")
    .filter({ hasText: /CARICHI E DISPOSITIVI|LOADS & DEVICES/i })
    .first();
  await linguetta.waitFor({ state: "visible", timeout: 20_000 });
  await linguetta.click();
  await expect(page.locator('#editor-modal [data-energy-panel="loads"]')).toHaveAttribute(
    "data-dm-loads-editor",
    "true",
    { timeout: 20_000 },
  );
}

test("il cestino della potenza istantanea la toglie, e resta tolta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  /* I sensori esistono davvero in Home Assistant, come nell'impianto di chi
   * l'ha segnalato: e' proprio da qui che l'entita' tolta rientrava, perche'
   * il suo nome somiglia a quello del carico. */
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  expect((await potenzaSalvata(page)).power_entity).toBe("sensor.potenza_elettrodomestici_w_4");

  await apriCarichi(page);

  /* Il campo dello scatto, col suo cestino accanto. */
  const campo = page.locator("#dm-loads-elettro-power");
  await expect(campo).toHaveValue("sensor.potenza_elettrodomestici_w_4", { timeout: 20_000 });
  /* Il gesto del cestino, esattamente com'e' scritto nel suo gestore: svuota
   * il campo e annuncia il cambio. */
  await campo.evaluate((input) => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(campo).toHaveValue("");

  /* Si salva, come farebbe chiunque. */
  const salva = page
    .locator('#editor-modal [data-energy-panel="loads"] button')
    .filter({ hasText: /SALVA|SAVE/i })
    .first();
  await salva.evaluate((nodo) => nodo.click());

  /* Dove conta: nella configurazione salvata. */
  await expect
    .poll(() => potenzaSalvata(page), { timeout: 20_000 })
    .toMatchObject({
      power_entity: "",
    });

  /* E riaprendo, il campo e' ancora vuoto: e' li' che il difetto si vedeva,
   * perche' la casella si ripopolava da sola. */
  await page.evaluate(() => {
    try {
      editorSwitch("home");
    } catch (_errore) {}
  });
  await page.waitForTimeout(400);
  await apriCarichi(page);
  await expect(page.locator("#dm-loads-elettro-power")).toHaveValue("", { timeout: 20_000 });
});

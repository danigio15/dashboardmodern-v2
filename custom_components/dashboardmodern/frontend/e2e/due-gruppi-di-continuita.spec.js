/* «Ti volevo chiedere se c'era la possibilità di aggiungere un secondo ups»
 * (#332).
 *
 * Ne esisteva uno solo, scritto come un oggetto. Adesso sono un elenco — come
 * i carichi, come le vetture — e chi ne aveva uno se lo ritrova primo della
 * fila senza dover toccare niente.
 *
 * Qui si guarda quello che vede chi ne configura due: due schede
 * nell'editor, due scene nella pagina Continuità, e una tessera in Home che
 * parla del gruppo messo peggio invece che del primo della lista.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ups: true },
};

/* La forma vecchia: un oggetto solo, come l'ha scritta chi aveva un UPS prima
 * che se ne potesse avere due. */
const UNO_SOLO = {
  name: "Rack",
  stato: "sensor.rack_stato",
  batteria: "sensor.rack_batteria",
};

async function avvia(page, testInfo, config = UNO_SOLO) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((salvata) => {
    localStorage.setItem("cd_ups", JSON.stringify(salvata));
    const stati = eval("_RAW_STATES");
    const metti = (id, stato, attributi = {}) => {
      stati[id] = {
        entity_id: id,
        state: String(stato),
        attributes: { friendly_name: id, ...attributi },
      };
    };
    /* Il rack e' in rete e carico; lo studio e' andato a batteria. */
    metti("sensor.rack_stato", "OL");
    metti("sensor.rack_batteria", 96, { unit_of_measurement: "%" });
    metti("sensor.studio_stato", "OB");
    metti("sensor.studio_batteria", 41, { unit_of_measurement: "%" });
    /* Una luce qualunque: la striscia dei widget in Home esiste solo se c'e'
     * qualcosa da mostrarci, e senza striscia l'assenza della tessera
     * dell'UPS non vorrebbe dire niente. */
    metti("light.salotto", "on");
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, config);
  await page.waitForTimeout(1500);
}

async function apriLaScheda(page) {
  /* La linguetta si preme, non si chiama: `editorSwitch` e' del guscio e le
   * schede dei moduli non le conosce — sarebbe una scorciatoia che nessun
   * utente ha. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="ups"]').click();
  await expect(page.locator("#ed-body .dm-ups-ed")).toHaveCount(1);
  /* Le caselle delle entita' le veste il selettore, che nasconde il campo e
   * mette i suoi bottoni: «Modifica manuale» e' il tasto con cui chi il
   * percorso lo sa gia' scrive a mano, ed e' la via piu' corta per una prova. */
  const aMano = page.locator("#ed-body .dm-slots-manual");
  if (await aMano.count()) await aMano.first().click();
}

const salvati = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("cd_ups") || "[]"));

test("chi ne aveva uno se lo ritrova, e può aggiungerne un secondo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);

  /* La configurazione vecchia — un oggetto — si legge come un elenco di uno. */
  const schede = page.locator("#ed-body [data-dm-ups-gruppo]");
  await expect(schede).toHaveCount(1);
  await expect(schede.first().locator('[data-dm-ups-field="name"]')).toHaveValue("Rack");

  await page.locator("#ed-body [data-dm-ups-aggiungi]").click();
  await expect(schede).toHaveCount(2);

  /* Il secondo si compila e si salva: il primo non si muove. */
  /* Le caselle delle entita' le veste il selettore, che il campo lo nasconde:
   * qui si scrive dentro il campo com'e' scritto, che e' quello che il
   * selettore fa quando si sceglie un'entita'. Il selettore ha le sue prove;
   * questa e' sul salvataggio. */
  await page.evaluate(() => {
    const scheda = document.querySelectorAll("#ed-body [data-dm-ups-gruppo]")[1];
    const scrivi = (campo, valore) => {
      const casella = scheda.querySelector(`[data-dm-ups-field="${campo}"]`);
      casella.value = valore;
      casella.dispatchEvent(new Event("input", { bubbles: true }));
      casella.dispatchEvent(new Event("change", { bubbles: true }));
    };
    scrivi("name", "Studio");
    scrivi("stato", "sensor.studio_stato");
    scrivi("batteria", "sensor.studio_batteria");
  });
  await page.locator("#ed-body [data-dm-ups-save]").evaluate((bottone) => bottone.click());

  await expect
    .poll(() => salvati(page))
    .toMatchObject([
      { name: "Rack", stato: "sensor.rack_stato", batteria: "sensor.rack_batteria" },
      { name: "Studio", stato: "sensor.studio_stato", batteria: "sensor.studio_batteria" },
    ]);
  /* E ognuno ha il suo nome interno, che non si ricava dal nome scritto: due
   * gruppi chiamati uguale restano due gruppi. */
  const uid = (await salvati(page)).map((gruppo) => gruppo.uid);
  expect(new Set(uid).size).toBe(2);
});

test("due gruppi, due scene nella pagina Continuità", async ({ page }, testInfo) => {
  await avvia(page, testInfo, [
    { uid: "ups-1", name: "Rack", stato: "sensor.rack_stato", batteria: "sensor.rack_batteria" },
    {
      uid: "ups-2",
      name: "Studio",
      stato: "sensor.studio_stato",
      batteria: "sensor.studio_batteria",
    },
  ]);
  await page.evaluate(() => document.querySelector('.tab[data-tab="ups"]')?.click());
  await expect(page.locator("#page-ups .dm-ups-stage")).toHaveCount(2);
  /* Col nome sopra ognuna: due scene identiche senza nome non si distinguono. */
  await expect(page.locator("#page-ups .dm-ups-titolo")).toHaveText(["Rack", "Studio"]);
});

test("la tessera in Home parla del gruppo messo peggio, non del primo", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, [
    { uid: "ups-1", name: "Rack", stato: "sensor.rack_stato", batteria: "sensor.rack_batteria" },
    {
      uid: "ups-2",
      name: "Studio",
      stato: "sensor.studio_stato",
      batteria: "sensor.studio_batteria",
    },
  ]);
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="ups"]');
  await expect(tessera).toBeVisible();
  /* Il Rack è primo della lista ed è in rete al 96%; lo Studio è andato a
   * batteria. Una tessera che mostrasse il primo direbbe «tutto a posto»
   * mentre l'altro è al buio. */
  await expect(tessera).toContainText("Studio");
  await expect(tessera).toContainText(/batteria/i);

  /* E nella finestra ci sono tutti e due, ognuno col suo nome davanti. */
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  await expect(finestra).toContainText("Rack · ");
  await expect(finestra).toContainText("Studio · ");
});

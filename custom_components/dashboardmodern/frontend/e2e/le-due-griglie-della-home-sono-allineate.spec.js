/* Le persone e i widget stanno una sotto l'altra nella stessa pagina: le loro
 * colonne devono cadere nello stesso posto.
 *
 * «Devi farli con le stesse misure delle card widget di larghezza, cerca di
 * adattare così da non creare sfalsi.» Le due griglie sono due regole CSS
 * diverse, in due moduli diversi, e nessuno teneva insieme i numeri: bastava
 * cambiare la colonna minima di una perché la Home sembrasse montata storta.
 *
 * Qui non si guardano i valori scritti nel foglio di stile — quelli si possono
 * cambiare in due punti e restare d'accordo per sbaglio — ma i rettangoli
 * veri: la prima card delle persone e la prima tessera dei widget devono
 * cominciare alla stessa ascissa ed essere larghe uguale, sul desktop e sul
 * telefono, dove entrambe passano a due colonne.
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
    lights: [
      { entity: "light.salotto", name: "Salotto" },
      { entity: "light.cucina", name: "Cucina" },
    ],
    climate: [{ entity: "climate.soggiorno", name: "Soggiorno" }],
    ev: [],
    covers: [{ entity: "cover.tapparella", name: "Camera" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const persone = [
  { id: "p1", name: "Andrea", entity: "person.andrea", battery: "sensor.andrea_battery" },
  { id: "p2", name: "Giulia", entity: "person.giulia" },
];

const STATI = {
  "person.andrea": {
    entity_id: "person.andrea",
    state: "Atos",
    attributes: { friendly_name: "Andrea" },
  },
  "sensor.andrea_battery": {
    entity_id: "sensor.andrea_battery",
    state: "55",
    attributes: { device_class: "battery", unit_of_measurement: "%" },
  },
  "person.giulia": {
    entity_id: "person.giulia",
    state: "home",
    attributes: { friendly_name: "Giulia" },
  },
  "light.salotto": {
    entity_id: "light.salotto",
    state: "on",
    attributes: { friendly_name: "Salotto", brightness: 180 },
  },
  "light.cucina": {
    entity_id: "light.cucina",
    state: "off",
    attributes: { friendly_name: "Cucina" },
  },
  "climate.soggiorno": {
    entity_id: "climate.soggiorno",
    state: "heat",
    attributes: { friendly_name: "Soggiorno", current_temperature: 21.5, temperature: 22 },
  },
  "cover.tapparella": {
    entity_id: "cover.tapparella",
    state: "open",
    attributes: { friendly_name: "Camera", current_position: 60, device_class: "shutter" },
  },
};

/* La prima card e la prima tessera, misurate sul documento. */
async function bordi(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const nodo = document.querySelector(sel);
      if (!nodo) return null;
      const r = nodo.getBoundingClientRect();
      return { left: r.left, width: r.width };
    };
    return { persona: box("#dm-people .dm-person-card"), widget: box("#dm-widgets .dm-tile") };
  });
}

test("le card delle persone e le tessere dei widget hanno le stesse colonne", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ people, stati }) => {
      window.localStorage.setItem("cd_people", JSON.stringify(people));
      const registro = eval("_RAW_STATES");
      for (const [id, stato] of Object.entries(stati)) registro[id] = stato;
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { people: persone, stati: STATI },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#dm-people .dm-person-card").first()).toBeVisible();
  await expect(page.locator("#dm-widgets .dm-tile").first()).toBeVisible();

  /* Il mezzo pixel e' arrotondamento del browser; un pixel intero no. */
  const allineate = async (dove) => {
    const misure = await bordi(page);
    expect(misure.persona, `${dove}: manca una card delle persone`).toBeTruthy();
    expect(misure.widget, `${dove}: manca una tessera dei widget`).toBeTruthy();
    expect(
      Math.abs(misure.persona.left - misure.widget.left),
      `${dove}: bordi diversi`,
    ).toBeLessThan(1);
    expect(
      Math.abs(misure.persona.width - misure.widget.width),
      `${dove}: larghezze diverse`,
    ).toBeLessThan(1);
  };

  await allineate("desktop");

  /* Sul telefono le due griglie passano a due colonne, e devono passarci
   * insieme: e' li' che uno sfalso si vede di piu'. */
  await page.setViewportSize({ width: 390, height: 1200 });
  await page.waitForTimeout(500);
  await allineate("telefono");
  const colonne = await page.evaluate(() => {
    const conta = (sel) =>
      getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(" ").length;
    return [conta("#dm-people .dm-people-grid"), conta("#dm-widgets .dm-widgets-grid")];
  });
  expect(colonne).toEqual([2, 2]);
});

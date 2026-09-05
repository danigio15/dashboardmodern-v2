/* Le linguette delle stanze, nella pagina Temperature, su uno schermo largo.
 *
 * «Se le stanze occupano più spazio nella finestra browser non vanno a capo»
 * (#329, segnalato da Edge su Windows a 1558 pixel). La striscia era
 * `display:flex` senza `flex-wrap`, con `overflow-x:auto` e la barra di
 * scorrimento nascosta apposta: sul telefono e' il gesto giusto — si trascina
 * col dito — ma col mouse non c'e' ne' la barra ne' il dito, e le stanze oltre
 * il bordo destro sparivano senza lasciare traccia di esistere.
 *
 * La prova guarda la cosa vera: quanto della striscia resta fuori dalla sua
 * scatola. Col mouse dev'essere zero, perche' va a capo; al tocco la striscia
 * puo' scorrere, ed e' giusto che scorra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Nomi di stanze veri e lunghi: una casa con dieci stanze non e' un caso
 * limite, e «Camera matrimoniale» e' il nome che la gente scrive davvero. */
const STANZE = [
  ["Salone", "mdi:sofa", "🛋️"],
  ["Cucina", "mdi:silverware", "🍴"],
  ["Camera matrimoniale", "mdi:bed-king", "🛏️"],
  ["Cameretta dei bambini", "mdi:bed", "🧸"],
  ["Bagno principale", "mdi:shower", "🚿"],
  ["Bagno di servizio", "mdi:toilet", "🚽"],
  ["Studio", "mdi:desk", "💻"],
  ["Taverna", "mdi:glass-wine", "🍷"],
  ["Mansarda", "mdi:home-roof", "🏠"],
  ["Garage", "mdi:garage", "🚗"],
];

const states = STANZE.map(([nome], indice) => ({
  entity_id: `sensor.stanza_${indice}_temperature`,
  state: String(20 + indice * 0.4),
  attributes: {
    friendly_name: `Temperatura ${nome}`,
    unit_of_measurement: "°C",
    device_class: "temperature",
  },
}));

const seed = {
  schema_version: 4,
  sections: {
    rooms: STANZE.map(([nome, mdi, emoji], indice) => ({
      id: `room_${indice}`,
      name: nome,
      icon: emoji || mdi,
      temp: `sensor.stanza_${indice}_temperature`,
      hum: "",
    })),
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
  visibility: { home: true, temp: true, temperature: true },
};

async function apriTemperature(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((haStates) => {
    const registry = eval("_RAW_STATES");
    for (const entry of haStates) registry[entry.entity_id] = entry;
  }, states);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    renderTemperature();
  });
  const striscia = page.locator("#dm-beta16-temperature-tabs");
  await expect(striscia).toBeVisible();
  // Una linguetta per stanza, piu' «Tutte»: se sono poche non c'e' niente da
  // mandare a capo e la prova non proverebbe nulla.
  await expect(striscia.locator("button")).toHaveCount(STANZE.length + 1);
  return striscia;
}

/* Dove si tocca lo schermo la striscia scorre, ed e' giusto che scorra: la
 * regola guarda il dispositivo di puntamento, e la prova fa la stessa domanda
 * al browser invece di indovinarla dal nome del progetto. */
async function saltaSeSiTocca(page) {
  const colMouse = await page.evaluate(
    () => matchMedia("(hover:hover) and (pointer:fine)").matches,
  );
  test.skip(!colMouse, "si tocca lo schermo: qui la striscia scorre col dito, ed e' voluto");
}

/* Quanto della striscia resta fuori dalla sua scatola, e quante righe occupa. */
const misura = (striscia) =>
  striscia.evaluate((nodo) => ({
    sforo: nodo.scrollWidth - nodo.clientWidth,
    righe: new Set([...nodo.querySelectorAll("button")].map((b) => b.getBoundingClientRect().top))
      .size,
  }));

test("col mouse le stanze vanno a capo invece di finire fuori dallo schermo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  // La larghezza della segnalazione: una finestra di Edge su Windows.
  await page.setViewportSize({ width: 1558, height: 900 });
  const striscia = await apriTemperature(page, testInfo);
  await saltaSeSiTocca(page);
  const { sforo, righe } = await misura(striscia);
  expect(sforo, "la striscia delle stanze sborda invece di andare a capo").toBeLessThanOrEqual(1);
  expect(righe, "dieci stanze in una riga sola vuol dire che non e' andata a capo").toBeGreaterThan(
    1,
  );
});

test("stretta la finestra, le stanze restano tutte raggiungibili", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.setViewportSize({ width: 720, height: 900 });
  const striscia = await apriTemperature(page, testInfo);
  await saltaSeSiTocca(page);
  const { sforo } = await misura(striscia);
  expect(
    sforo,
    "stretta la finestra la striscia deve andare a capo, non sbordare",
  ).toBeLessThanOrEqual(1);
});
